import { readText, pathExists, sleep, isStandaloneBinary } from "../utils/node-compat";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import consola from "consola";
import { argv, cwd, env, execPath, exit } from "node:process";
import { join } from "node:path";
import { closeSync, existsSync, openSync } from "node:fs";
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { progress } from "../progress";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { selectMode } from "../utils/select-mode";
import {
    clearState,
    ensureCookbookDir,
    getLogsDir,
    isPidAlive,
    isRunning,
    killProcessTree,
    readState,
    stopBackground,
    waitForWorkersReadyByStatus,
    writeState,
    type WorkersReadyResult,
} from "../utils/background";
import { createSession, finalizeSession, getSessionDir, readCurrentSession, updateSessionMeta, writeCurrentSession } from "../logs/session";
import { installLogCollector, writeSessionEvent } from "../logs/collector";
import { readBootstrapTail } from "../logs/bootstrap";
import { startSessionLogTail } from "../logs/tail";

export default await defineCookbookCommand(async (utils) => {
    const params = utils.getParams();
    const cookbookToml = join(cwd(), "cookbook.toml");
    if (!(await pathExists(cookbookToml))) {
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

    const options = await getCookbookToml(await readText(cookbookToml), progress);
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
    // A self-contained binary (Node SEA for co.exe, or a Bun compiled binary)
    // has no real script path at argv[1]; it re-executes itself and passes the
    // command name instead. Source runs (node/tsx cookbook.ts) forward the real
    // entry script, keeping the parent's loader args (tsx) so the child can
    // import TypeScript as well.
    const command = !isStandaloneBinary() && entry && existsSync(entry)
        ? [execPath, ...process.execArgv, entry, "dev", `--mode=${mode}`, ...forwardedArgs]
        : [execPath, "dev", `--mode=${mode}`, ...forwardedArgs];

    // Take over the session pointer: the previous run is replaced by this one.
    const previous = readCurrentSession();
    if (previous) {
        writeSessionEvent(previous.sessionId, { source: "co:start", stream: "system", text: "stopped by a new run", kind: "session-replaced" });
        finalizeSession(previous.sessionId, "replaced", "stopped by a new run");
    }

    const meta = createSession({ mode });
    const sessionId = meta.sessionId;
    const cookbookDir = ensureCookbookDir();
    const bootstrapPath = join(getSessionDir(sessionId), `bootstrap-${sessionId}.log`);
    await rm(bootstrapPath, { force: true }).catch(() => {});
    // drop stale worker statuses from a previous run: the readiness wait below
    // treats this file as the single source of truth and must never act on
    // outdated information
    await rm(join(cookbookDir, "workers-status.json"), { force: true }).catch(() => {});

    const collector = installLogCollector({
        source: "co:start",
        sessionId,
        captureConsole: true,
        mirror: true,
        bootstrapLogPath: bootstrapPath,
        finalizeOnExit: true,
    });

    const recordStartupFailure = (reason: string): void => {
        // The background process' pre-collector output is the only clue about
        // why it died, so preserve it in the session and print the tail.
        const bootLines = readBootstrapTail(bootstrapPath, { maxBytes: 1024 * 1024, maxLines: 100 });
        if (bootLines.length > 0) {
            try {
                collector.record("cookbook:boot", "stderr", `${bootLines.join("\n")}\n`, { kind: "boot-error" });
                collector.flushSync();
                collector.writeTerminal("stderr", `${bootLines.join("\n")}\n`);
            } catch {
                // ignore
            }
        }
        try {
            collector.event("cookbook", "error", reason, { kind: "session-failed", meta: { error: reason } });
        } catch {
            // ignore
        }
        collector.detachOwnership();
        try {
            finalizeSession(sessionId, "failed", reason, 1);
        } catch {
            // ignore
        }
    };

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
        const pidPath = join(cookbookDir, "dev-pid.md");
        await rm(pidPath, { force: true });

        const launcherPath = join(cookbookDir, "dev-launcher.js");
        const innerCommand = command.map((arg) => `"${arg}"`).join(" ");
        // stdout/stderr of the background process are redirected to the
        // bootstrap log; the collector imports its tail once it is installed.
        const cmdLine = `cmd.exe /c set "COOKBOOK_BACKGROUND=1"&& set "COOKBOOK_LOG_SESSION=${sessionId}"&& set "COOKBOOK_BOOTSTRAP_LOG=${bootstrapPath}"&& ${innerCommand} 1>>"${bootstrapPath}" 2>&1`;
        const launcherSource = ['var shell = new ActiveXObject("WScript.Shell");', `shell.CurrentDirectory = ${JSON.stringify(cwd())};`, `shell.Run(${JSON.stringify(cmdLine)}, 0, false);`, ""].join("\r\n");
        await writeFile(launcherPath, launcherSource, "utf-8");

        const launcher = spawn("wscript.exe", [launcherPath], { detached: true, stdio: "ignore", cwd: cwd() });
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
            await sleep(100);
        }

        if (!pid) {
            recordStartupFailure("Failed to start the background dev server process.");
            consola.error("Failed to start the background dev server process.");
            consola.info(`Run "co dev --mode=${mode}" in the foreground to see the error directly.`);
            exit(1);
        }
        const childPid = pid;
        isChildAlive = () => isPidAlive(childPid);
    } else {
        // POSIX: inherit the bootstrap log as stdout/stderr via an append fd,
        // then drop the parent's copy once the child owns it.
        const logFd = openSync(bootstrapPath, "a");
        let child;
        try {
            child = spawn(command[0], command.slice(1), {
                cwd: cwd(),
                // COOKBOOK_BACKGROUND skips the "stop existing background server" step
                // in dev.ts (so it does not kill itself).
                env: { ...env, COOKBOOK_BACKGROUND: "1", COOKBOOK_LOG_SESSION: sessionId, COOKBOOK_BOOTSTRAP_LOG: bootstrapPath },
                detached: true,
                stdio: ["ignore", logFd, logFd],
            });
        } finally {
            closeSync(logFd);
        }
        child.unref();

        let childExited = false;
        child.on("exit", () => {
            childExited = true;
        });

        if (!child.pid) {
            recordStartupFailure("Failed to start the background dev server process.");
            consola.error("Failed to start the background dev server process.");
            consola.info(`Run "co dev --mode=${mode}" in the foreground to see the error directly.`);
            exit(1);
        }
        pid = child.pid;
        isChildAlive = () => !childExited;
    }

    const childPid = pid;
    if (typeof childPid !== "number") {
        exit(1);
    }
    updateSessionMeta(sessionId, { pid: childPid });
    writeCurrentSession({ sessionId, startedAt: meta.startedAt, pid: childPid, mode });
    // the background process owns the session from now on
    collector.detachOwnership();
    collector.event("co:start", "info", `handed the session over to the background process (pid ${childPid})`, { kind: "session-handoff", meta: { pid: childPid } });

    await writeState({
        pid: childPid,
        mode,
        ports: targets.map((target) => target.port),
        startedAt: new Date().toISOString(),
    });

    progress.open("waiting for projects to be ready..");
    // While the readiness checks are running, mirror the background session
    // logs to the terminal; once ready (or failed), it logs to files only.
    const stopLogTail = startSessionLogTail({ sessionId });
    let result: WorkersReadyResult;
    try {
        const timeoutOption = Number(params.options.timeout);
        const overallTimeoutMs = Number.isFinite(timeoutOption) && timeoutOption > 0 ? timeoutOption * 1000 : 600_000;
        result = await waitForWorkersReadyByStatus(targets, {
            overallTimeoutMs,
            isAborted: () => !isChildAlive(),
        });
    } finally {
        stopLogTail();
    }

    if (!result.success) {
        await progress.close("");
        await killProcessTree(childPid);
        await clearState();
        const reason = result.error ?? "The background dev server failed to become ready.";
        recordStartupFailure(reason);
        consola.error(`Failed to start the background dev server: ${reason}`);
        consola.info(`Run "co logs" to inspect the log output.`);
        exit(1);
    }

    await progress.close("");
    for (const target of targets) {
        consola.info(`  ${target.name}: ${target.url}`);
    }
    try {
        collector.event("cookbook", "info", `${targets.length} project(s) ready`, {
            kind: "session-ready",
            meta: {
                projects: targets.map((target) => ({
                    project: target.name,
                    url: target.url,
                    readyMs: result.ready?.[target.name]?.readyMs,
                    attempts: result.ready?.[target.name]?.attempts,
                })),
            },
        });
    } catch {
        // ignore
    }
    consola.info(`Logs: ${getLogsDir()} (run "co logs" to follow)`);
    consola.success(`The dev server is now running in the background (pid ${childPid}, mode: ${mode}). Run "co stop" to stop it.`);
});
