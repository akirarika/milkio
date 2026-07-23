import { defineCookbookCommand } from "@milkio/cookbook-command";
import consola from "consola";
import { argv, cwd, env, execPath, exit } from "node:process";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { progress } from "../progress";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { selectMode } from "../utils/select-mode";
import { startLogTail } from "../utils/log-tail";
import { clearState, ensureCookbookDir, getCookbookDir, getLogsDir, isPidAlive, isRunning, killProcessTree, readState, stopBackground, waitForProjectsReady, writeState } from "../utils/background";

export default await defineCookbookCommand(async (utils) => {
    const params = utils.getParams();
    const cookbookToml = Bun.file(join(cwd(), "cookbook.toml"));
    if (!(await cookbookToml.exists())) {
        consola.error(`The "cookbook.toml" file does not exist in the current directory: ${join(cwd())}`);
        consola.info(`Hint: run "co init" in an empty directory to create a new cookbook project.`);
        exit(1);
    }

    // running "co start" again is equivalent to stopping the previous background
    // dev server first and then starting a fresh one
    const existing = await readState();
    if (existing) {
        if (isRunning(existing)) {
            consola.info(`A background cookbook dev server (pid ${existing.pid}) is already running. Stopping it first..`);
            await stopBackground(existing);
        }
        await clearState();
    }

    const options = await getCookbookToml(await cookbookToml.text(), progress);
    const mode = await selectMode(options, params);

    const targets = Object.entries(options.projects ?? {})
        .filter(([, project]) => project.autoStart !== false)
        .map(([name, project]) => ({
            name,
            port: project.port,
            url: project.connectTestUrl ?? `http://localhost:${project.port}/`,
        }));

    const forwardedArgs = params.raw.filter((arg) => arg !== "--mode" && !arg.startsWith("--mode="));
    const entry = argv[1];
    // Bun-compiled binaries expose their embedded entry point as a virtual
    // path like "B:/~BUN/root/co" — and existsSync() sees it through the
    // embedded filesystem, so it passes the existsSync check. Forwarding that
    // virtual path as a script argument makes the child process receive it as
    // its COMMAND name and exit immediately. Only forward real on-disk entry
    // scripts (e.g. when running via "bun run cookbook.ts").
    const isVirtualEmbeddedEntry = typeof entry === "string" && entry.includes("/~BUN/");
    const command = entry && !isVirtualEmbeddedEntry && existsSync(entry) ? [execPath, entry, "dev", `--mode=${mode}`, ...forwardedArgs] : [execPath, "dev", `--mode=${mode}`, ...forwardedArgs];

    let pid: number | undefined;
    let isChildAlive: () => boolean;

    if (process.platform === "win32") {
        // Windows: launch the background dev server through a WScript.Shell
        // wrapper so the whole process tree shares a single hidden console.
        //
        // Why not "detached + windowsHide"? A detached/hidden parent has no
        // console (or none that descendants may inherit), so every console-app
        // descendant down the tree (cmd.exe for npm.cmd, node, tsgo, ...) ends
        // up creating its OWN visible console window — observed as dozens of
        // flashing windows during startup. WScript.Shell.Run(cmd, 0, false)
        // creates the root process with a hidden console window, and all
        // descendants simply inherit that console: no new windows, fully
        // detached from the user's terminal.
        const cookbookDir = ensureCookbookDir();
        const pidPath = join(cookbookDir, "dev-pid.md");
        await rm(pidPath, { force: true });
        // drop stale worker statuses from a previous run so the failure
        // detection below never acts on outdated information
        await rm(join(cookbookDir, "workers-status.json"), { force: true });

        const launcherPath = join(cookbookDir, "dev-launcher.js");
        const innerCommand = command.map((arg) => `"${arg}"`).join(" ");
        const cmdLine = `cmd.exe /c set "COOKBOOK_BACKGROUND=1"&& ${innerCommand}`;
        const launcherSource = ['var shell = new ActiveXObject("WScript.Shell");', `shell.CurrentDirectory = ${JSON.stringify(cwd())};`, `shell.Run(${JSON.stringify(cmdLine)}, 0, false);`, ""].join("\r\n");
        await writeFile(launcherPath, launcherSource, "utf-8");

        const launcher = spawn("wscript.exe", [launcherPath], { stdio: "ignore", cwd: cwd() });
        launcher.unref();

        // The dev server writes its own pid to "<cwd>/node_modules/.cookbook/dev-pid.md"
        // on startup (see dev.ts), because the real pid is not directly
        // observable through the WScript wrapper.
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
            consola.error("Failed to start the background dev server process.");
            consola.info(`Run "co dev --mode=${mode}" in the foreground to see the error directly.`);
            exit(1);
        }
        const childPid = pid;
        isChildAlive = () => isPidAlive(childPid);
    } else {
        const child = spawn(command[0], command.slice(1), {
            cwd: cwd(),
            // COOKBOOK_BACKGROUND skips the "stop existing background server" step
            // in dev.ts (so it does not kill itself).
            env: { ...env, COOKBOOK_BACKGROUND: "1" },
            detached: true,
            stdio: "ignore",
        });
        child.unref();

        let childExited = false;
        child.on("exit", () => {
            childExited = true;
        });

        if (!child.pid) {
            consola.error("Failed to start the background dev server process.");
            exit(1);
        }
        pid = child.pid;
        isChildAlive = () => !childExited;
    }

    await writeState({
        pid,
        mode,
        ports: targets.map((target) => target.port),
        startedAt: new Date().toISOString(),
    });

    progress.open("waiting for projects to be ready..");
    // While the health-checks are still running, mirror the background server's
    // log output to the terminal; once ready (or failed), it logs to files only.
    const stopLogTail = startLogTail();
    // Fail fast when a worker's dev server process dies before its URL ever
    // responded (the background dev server publishes worker states to
    // "workers-status.json"); without this, a dead worker would only surface
    // after the full overall timeout.
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
    let result: { success: boolean; error?: string };
    try {
        const timeoutOption = Number(params.options.timeout);
        const overallTimeoutMs = Number.isFinite(timeoutOption) && timeoutOption > 0 ? timeoutOption * 1000 : 600_000;
        result = await waitForProjectsReady(targets, {
            intervalMs: 1000,
            requestTimeoutMs: 5000,
            overallTimeoutMs,
            isAborted: () => !isChildAlive(),
            getFailure: getWorkerFailure,
        });
    } finally {
        stopLogTail();
    }

    if (!result.success) {
        await progress.close("");
        await killProcessTree(pid);
        await clearState();
        consola.error(`Failed to start the background dev server: ${result.error}`);
        consola.info(`Run "co logs" to inspect the log output.`);
        exit(1);
    }

    await progress.close("");
    for (const target of targets) {
        consola.info(`  ${target.name}: ${target.url}`);
    }
    consola.info(`Logs: ${getLogsDir()} (run "co logs" to follow)`);
    consola.success(`The dev server is now running in the background (pid ${pid}, mode: ${mode}). Run "co stop" to stop it.`);
});
