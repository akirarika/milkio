import chalk from "chalk";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import { progress } from "../progress";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { join } from "node:path";
import consola from "consola";
import { argv, cwd, env, execPath, exit } from "node:process";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { readFile, writeFile, rm } from "node:fs/promises";
import { calcHash } from "../utils/calc-hash";
import { getRandomPort } from "../utils/get-random-port";
import { clearState, ensureCookbookDir, getCookbookDir, isPidAlive, isRunning, readState, stopBackground, writeState } from "../utils/background";
import { startLogTail } from "../utils/log-tail";
import { installBackgroundLogger } from "../utils/background-logger";
import { execScript } from "../utils/exec-script";

const isBackground = env.COOKBOOK_TEST_BACKGROUND === "1";

function getTestResultPath() {
    return join(getCookbookDir(), "test-result.json");
}

export default await defineCookbookCommand(async (utils) => {
    const params = utils.getParams();
    const cookbookToml = Bun.file(join(cwd(), "cookbook.toml"));
    if (!(await cookbookToml.exists())) {
        consola.error(`The "cookbook.toml" file does not exist in the current directory: ${join(cwd())}`);
        exit(0);
    }
    const cookbookTomlText = await cookbookToml.text();
    const cookbookTomlHash = calcHash(cookbookTomlText);
    const options = await getCookbookToml(cookbookTomlText, progress);
    options.hash = cookbookTomlHash;

    const packageJson = existsSync(join(cwd(), "package.json")) ? JSON.parse(await readFile(join(cwd(), "package.json"), "utf-8")) : undefined;
    if (!packageJson?.scripts?.test) {
        consola.error(`The "test" script is not defined in the "package.json" file, try add it.`);
        exit(1);
    }

    if (!packageJson?.devDependencies?.vitest && !packageJson?.dependencies?.vitest) {
        consola.error(`The "vitest" package is not defined in the "package.json" file, try run:\n${options.general.packageManager} i vitest`);
        exit(1);
    }

    // ============================================================
    // 后台子进程（由前台 co test 以 COOKBOOK_TEST_BACKGROUND=1 启动）：
    // 执行全部测试逻辑，测试结束后写 test-result.json 供前台读取，
    // 然后保持运行（等同 "co start" 的后台 dev server，用户可继续访问
    // 本地网页，直到手动 "co stop"）。
    // ============================================================
    if (isBackground) {
        // 与前台 "co" 入口的 --preload 对齐（约定为 cwd/co-preload.ts）：
        // 预热 cookbook-server 的 .milkio，否则 createAstra 动态加载 cookbook-server
        // 会得到空 routeSchema（0 routes），/mode/read 返回 NOT_FOUND，
        // 所有经 createAstra 的测试（embed/electron 等）都会失败。
        try {
            await import(join(cwd(), "co-preload.ts"));
        } catch {}

        await writeFile(join(ensureCookbookDir(), "dev-pid.md"), `${process.pid}`, "utf-8");
        await rm(join(ensureCookbookDir(), "workers-status.json"), { force: true }).catch(() => {});

        installBackgroundLogger();
        await runTestsAndKeepServer(params, options);
        return;
    }

    // ============================================================
    // 前台：启动后台测试进程（detached），镜像其日志，等待
    // test-result.json 出现后以测试结果退出，释放终端。
    // 后台 dev server 持续运行（除非 "co test --stop"）。
    // ============================================================
    // 与 "co start" 对齐：若已有后台 dev server 在运行，先停止它，避免项目端口冲突
    const existing = await readState();
    if (existing) {
        if (isRunning(existing)) {
            consola.info(`A background cookbook dev server (pid ${existing.pid}) is already running. Stopping it first..`);
            await stopBackground(existing);
        }
        await clearState();
    }

    await rm(getTestResultPath(), { force: true }).catch(() => {});
    await rm(join(getCookbookDir(), "dev-pid.md"), { force: true }).catch(() => {});

    const entry = argv[1];
    // Bun-compiled binaries expose their embedded entry point as a virtual
    // path like "B:/~BUN/root/co" — only forward real on-disk entry scripts.
    const isVirtualEmbeddedEntry = typeof entry === "string" && entry.includes("/~BUN/");
    const command = entry && !isVirtualEmbeddedEntry && existsSync(entry) ? [execPath, entry, "test", ...params.raw] : [execPath, "test", ...params.raw];

    let pid: number | undefined;
    if (process.platform === "win32") {
        // 与 co start 相同：通过 WScript.Shell 隐藏控制台启动，整个进程树共享一个隐藏 console
        const cookbookDir = ensureCookbookDir();
        const pidPath = join(cookbookDir, "dev-pid.md");
        const launcherPath = join(cookbookDir, "test-launcher.js");
        const innerCommand = command.map((arg) => `"${arg}"`).join(" ");
        const cmdLine = `cmd.exe /c set "COOKBOOK_TEST_BACKGROUND=1"&& ${innerCommand}`;
        const launcherSource = ['var shell = new ActiveXObject("WScript.Shell");', `shell.CurrentDirectory = ${JSON.stringify(cwd())};`, `shell.Run(${JSON.stringify(cmdLine)}, 0, false);`, ""].join("\r\n");
        await writeFile(launcherPath, launcherSource, "utf-8");
        const launcher = spawn("wscript.exe", [launcherPath], { detached: true, stdio: "ignore", cwd: cwd() });
        launcher.unref();

        // 后台进程启动时会把自己 pid 写入 dev-pid.md（见上方 isBackground 分支）
        const startedAt = Date.now();
        while (Date.now() - startedAt < 30_000) {
            try {
                const text = await readFile(pidPath, "utf-8");
                const candidate = Number(text.trim());
                if (Number.isInteger(candidate) && candidate > 0 && isPidAlive(candidate)) {
                    pid = candidate;
                    break;
                }
            } catch {}
            await Bun.sleep(100);
        }
        if (!pid) {
            consola.error("Failed to start the background test process.");
            consola.info(`Run "co test" in the foreground (COOKBOOK_TEST_BACKGROUND=0) to see the error directly.`);
            exit(1);
        }
    } else {
        const child = spawn(command[0], command.slice(1), {
            cwd: cwd(),
            env: { ...env, COOKBOOK_TEST_BACKGROUND: "1" },
            detached: true,
            stdio: "ignore",
        });
        child.unref();
        pid = child.pid;
    }

    // 记录后台状态：测试结束后 dev server 仍在运行，可用 "co stop" 停止
    const targets = Object.entries(options.projects ?? {})
        .filter(([, project]) => project.autoStart !== false)
        .map(([name, project]) => ({ name, port: (project as any).port }));
    await writeState({ pid, mode: "test", ports: targets.map((target) => target.port), startedAt: new Date().toISOString() });

    // 镜像后台日志到终端（watcher / typecheck / 测试进度）
    const stopLogTail = startLogTail();
    try {
        const timeoutOption = Number(params.options.timeout);
        const overallTimeoutMs = Number.isFinite(timeoutOption) && timeoutOption > 0 ? timeoutOption * 1000 : 7_200_000;
        const deadline = Date.now() + overallTimeoutMs;
        let result: { exitCode: number } | undefined;
        while (Date.now() < deadline) {
            if (pid && !isPidAlive(pid) && !result) {
                try {
                    const candidate = JSON.parse(await readFile(getTestResultPath(), "utf-8"));
                    if (typeof candidate?.exitCode === "number") result = candidate;
                } catch {}
                if (!result) {
                    consola.error("The background test process exited before writing a test result.");
                    exit(1);
                }
                break;
            }
            try {
                const candidate = JSON.parse(await readFile(getTestResultPath(), "utf-8"));
                if (typeof candidate?.exitCode === "number") {
                    result = candidate;
                    break;
                }
            } catch {}
            await Bun.sleep(500);
        }
        if (!result) {
            consola.error(`Timed out waiting for the test result (${overallTimeoutMs / 1000}s). The background dev server (pid ${pid}) is still running; run "co stop" to stop it.`);
            exit(1);
        }
        consola.success(`Test command completed with exit code ${result.exitCode}.`);
        consola.info(`The dev servers are still running in the background (pid ${pid}, mode: test). Run "co stop" to stop them.`);
        exit(result.exitCode);
    } finally {
        stopLogTail();
    }
});

async function runTestsAndKeepServer(params: { raw: string[]; options: Record<string, string> }, options: any) {
    const start = async (mode: string) => {
        (globalThis as any).__COOKBOOK_OPTIONS__ = options;
        progress.open("cookbook is starting..");
        const startTime = new Date();
        const { initWatcher } = await import("../watcher");
        await initWatcher(options, mode, true);

        const { typecheckProjects } = await import("../utils/typecheck");
        await typecheckProjects(options);

        const cookbookServerAccessKey = `c${await calcHash(crypto.randomUUID())}`;

        const cookbookServerPort = await getRandomPort();
        const cookbookServerBaseUrl = `http://localhost:${cookbookServerPort}/${cookbookServerAccessKey}`;
        await writeFile(join(getCookbookDir(), "control-url.md"), cookbookServerBaseUrl);

        const { startCookbookServer } = await import("@milkio/cookbook-server");
        const _server = await startCookbookServer({ port: cookbookServerPort, accessKey: cookbookServerAccessKey });

        const { initWorkers } = await import("../workers");
        await initWorkers(options, mode, cookbookServerBaseUrl);

        // co test spawns each project's dev server via initWorkers but does not
        // wait for their HTTP endpoints to become ready before running vitest.
        // For unit/integration tests that call into the backend in-process
        // (createMirrorWorld) this is fine, but e2e tests that drive a real
        // browser against a dev server URL need the server listening first.
        // Reuse the same readiness check that "co start" relies on.
        const { waitForProjectsReady } = await import("../utils/background");
        const targets = Object.entries(options.projects ?? {})
            .filter(([, project]) => project.autoStart !== false)
            .map(([name, project]) => ({
                name,
                port: (project as any).port,
                url: (project as any).connectTestUrl ?? ((project as any).type !== "milkio" ? `http://localhost:${(project as any).port}/` : `http://localhost:${(project as any).port}/generate_204`),
            }));
        if (targets.length > 0) {
            const workersStatusPath = join(getCookbookDir(), "workers-status.json");
            const getWorkerFailure = async (): Promise<string | undefined> => {
                let status: Record<string, { state?: string; exitCode?: number | null }>;
                try {
                    status = JSON.parse(await readFile(workersStatusPath, "utf-8"));
                } catch {
                    return undefined;
                }
                for (const target of targets) {
                    const worker = status?.[target.name];
                    if (worker?.state === "stopped" && typeof worker.exitCode === "number") {
                        return `The dev server process of project "${target.name}" exited with code ${worker.exitCode} before becoming ready.`;
                    }
                }
                return undefined;
            };
            const ready = await waitForProjectsReady(targets, {
                intervalMs: 1000,
                requestTimeoutMs: 5000,
                overallTimeoutMs: 600_000,
                getFailure: getWorkerFailure,
            });
            if (!ready.success) {
                startError = `Failed to start project dev servers: ${ready.error}`;
                return;
            }
        }

        const endTime = new Date();
        const time = Math.max(endTime.getTime() - startTime.getTime(), 0);
        await progress.close(chalk.gray("cookbook is ready."));
        console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Time taken: ") + chalk.hex("#24B56A")(`${time}ms`) + (time > 8192 ? chalk.gray(" (✨ cached! next start faster)") : ""));
        console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Current mode: ") + chalk.hex("#24B56A")(mode));
        console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Current mode: ") + chalk.hex("#24B56A")(mode));

        console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Base URL: ") + chalk.hex("#24B56A")(cookbookServerBaseUrl));

        console.log("");
    };

    const stopWorkers = async () => {
        // 停止由本命令启动的所有 dev server（workers），避免测试结束后进程残留占用端口
        try {
            const { workers } = await import("../workers");
            await Promise.allSettled([...workers.values()].map((worker) => worker.kill()));
        } catch {}
    };

    // start() 内部无法直接 exit（会导致 workers 残留），改为记录错误后返回，由调用方统一清理
    let startError: string | undefined;
    try {
        await start("test");
    } catch (error) {
        startError = "Failed to start cookbook test server: " + String(error);
    }

    if (startError) {
        await progress.close("");
        await stopWorkers();
        consola.error(startError);
        await writeFile(getTestResultPath(), JSON.stringify({ exitCode: 1, finishedAt: new Date().toISOString() }), "utf-8");
        exit(1);
    }

    // 默认在测试结束后保持 dev server 运行，方便继续调试；
    // 只有显式传入 --stop 时才会在测试结束后停止由本命令启动的所有服务器
    const shouldStopWorkers = params.options.stop === "1" || params.options.stop === "true";

    let exitcode: number;
    try {
        const rawArgs = params.raw.filter((arg) => arg !== "--stop" && !arg.startsWith("--stop="));
        const scriptParts = [`${options.general.packageManager} run test`, ...rawArgs.map((arg) => `"${arg}"`)];
        exitcode = await execScript(scriptParts.join(" "), { cwd: cwd() });
    } finally {
        if (shouldStopWorkers) await stopWorkers();
    }

    if (exitcode !== 0) {
        consola.error(`Test command failed with exit code ${exitcode}.`);
    } else {
        await writeFile(join(cwd(), "node_modules", ".cookbook__success-time-of-test-run"), `${Date.now()}`);

        consola.info("The timestamp of the completed test run has been written to \"/node_modules/.cookbook__success-time-of-test-run\". If you need to avoid re-running the tests in the CI step, you can refer to the time in this file.\n");

        consola.success("Test command completed!");
    }

    // 把结果写给前台 co test 读取
    await writeFile(getTestResultPath(), JSON.stringify({ exitCode: exitcode, finishedAt: new Date().toISOString() }), "utf-8");

    if (shouldStopWorkers) {
        exit(exitcode);
    }

    // 后台保持：dev server 持续运行，本地网页（如 localhost:9007）保持可访问，
    // 直到手动执行 "co stop"
    const resolvers = Promise.withResolvers();
    await resolvers.promise;
}
