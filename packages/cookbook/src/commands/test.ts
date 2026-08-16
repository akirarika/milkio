import chalk from "chalk";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import { progress } from "../progress";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { join } from "node:path";
import consola from "consola";
import { cwd, exit } from "node:process";
import { calcHash } from "../utils/calc-hash";
import { getRandomPort } from "../utils/get-random-port";
import { exists, readFile, writeFile } from "node:fs/promises";
import { clearState, getCookbookDir, isRunning, readState, stopBackground } from "../utils/background";
import { installBackgroundLogger } from "../utils/background-logger";
import { execScript } from "../utils/exec-script";

export default await defineCookbookCommand(async (utils) => {
    installBackgroundLogger();
    const cookbookToml = Bun.file(join(cwd(), "cookbook.toml"));
    if (!(await cookbookToml.exists())) {
        consola.error(`The "cookbook.toml" file does not exist in the current directory: ${join(cwd())}`);
        exit(0);
    }
    const cookbookTomlText = await cookbookToml.text();
    const cookbookTomlHash = calcHash(cookbookTomlText);
    const options = await getCookbookToml(cookbookTomlText, progress);
    options.hash = cookbookTomlHash;

    const packageJson = (await exists(join(cwd(), "package.json"))) ? JSON.parse(await readFile(join(cwd(), "package.json"), "utf-8")) : undefined;
    if (!packageJson?.scripts?.test) {
        consola.error(`The "test" script is not defined in the "package.json" file, try add it.`);
        exit(1);
    }

    if (!packageJson?.devDependencies?.vitest && !packageJson?.dependencies?.vitest) {
        consola.error(`The "vitest" package is not defined in the "package.json" file, try run:\n${options.general.packageManager} i vitest`);
        exit(1);
    }

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
                port: project.port,
                url: project.connectTestUrl ?? (project.type !== "milkio" ? `http://localhost:${project.port}/` : `http://localhost:${project.port}/generate_204`),
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

    const params = utils.getParams();

    const stopWorkers = async () => {
        // 停止由本命令启动的所有 dev server（workers），避免测试结束后进程残留占用端口
        try {
            const { workers } = await import("../workers");
            await Promise.allSettled([...workers.values()].map((worker) => worker.kill()));
        } catch {}
    };

    // 与 "co start" 对齐：若已有后台 dev server 在运行，先停止它，避免项目端口冲突
    const existing = await readState();
    if (existing) {
        if (isRunning(existing)) {
            consola.info(`A background cookbook dev server (pid ${existing.pid}) is already running. Stopping it first..`);
            await stopBackground(existing);
        }
        await clearState();
    }

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
        exit(1);
    }

    let exitcode: number;
    try {
        const scriptParts = [`${options.general.packageManager} run test`, ...params.raw.map((arg) => `"${arg}"`)];
        exitcode = await execScript(scriptParts.join(" "), { cwd: cwd() });
    } finally {
        await stopWorkers();
    }

    if (exitcode !== 0) {
        consola.error(`Test command failed with exit code ${exitcode}.`);
        exit(exitcode);
    }

    await writeFile(join(cwd(), "node_modules", ".cookbook__success-time-of-test-run"), `${Date.now()}`);

    consola.info("The timestamp of the completed test run has been written to \"/node_modules/.cookbook__success-time-of-test-run\". If you need to avoid re-running the tests in the CI step, you can refer to the time in this file.\n");

    consola.success("Test command completed!");
});
