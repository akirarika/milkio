import { defineCookbookCommand } from "@milkio/cookbook-command";
import consola from "consola";
import { argv, cwd, env, execPath, exit } from "node:process";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { progress } from "../progress";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { selectMode } from "../utils/select-mode";
import { clearState, getLogsDir, isRunning, killProcessTree, readState, stopBackground, waitForProjectsReady, writeState } from "../utils/background";

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
    const command = entry && existsSync(entry) ? [execPath, entry, "dev", `--mode=${mode}`, ...forwardedArgs] : [execPath, "dev", `--mode=${mode}`, ...forwardedArgs];

    const child = spawn(command[0], command.slice(1), {
        cwd: cwd(),
        // COOKBOOK_BACKGROUND makes the child install the rotating file logger and
        // skip the "stop existing background server" step in dev.ts (so it does not
        // kill itself). FORCE_COLOR keeps the captured logs colored like "co dev".
        env: { ...env, COOKBOOK_BACKGROUND: "1", FORCE_COLOR: "1" },
        detached: true,
        stdio: "ignore",
        windowsHide: true,
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

    await writeState({
        pid: child.pid,
        mode,
        ports: targets.map((target) => target.port),
        startedAt: new Date().toISOString(),
    });

    progress.open("waiting for projects to be ready..");
    const timeoutOption = Number(params.options.timeout);
    const overallTimeoutMs = Number.isFinite(timeoutOption) && timeoutOption > 0 ? timeoutOption * 1000 : 600_000;
    const result = await waitForProjectsReady(targets, {
        intervalMs: 1000,
        requestTimeoutMs: 5000,
        overallTimeoutMs,
        isAborted: () => childExited,
    });

    if (!result.success) {
        await progress.close("");
        await killProcessTree(child.pid);
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
    consola.success(`The dev server is now running in the background (pid ${child.pid}, mode: ${mode}). Run "co stop" to stop it.`);
});
