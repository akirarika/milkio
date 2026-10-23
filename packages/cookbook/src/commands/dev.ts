import chalk from "chalk";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import { progress } from "../progress";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { selectMode } from "../utils/select-mode";
import { join } from "node:path";
import consola from "consola";
import { cwd, env, exit } from "node:process";
import { calcHash } from "../utils/calc-hash";
import { getRandomPort } from "../utils/get-random-port";
import { writeFile, rm } from "node:fs/promises";
import { getCookbookDir } from "../utils/background";
import { createSession, finalizeSession, readCurrentSession } from "../logs/session";
import { installLogCollector, writeSessionEvent } from "../logs/collector";

export default await defineCookbookCommand(async (utils) => {
    // The background child of "co start" reuses the session created by the
    // foreground launcher and never stops/finalizes an existing run.
    const isBackground = env.COOKBOOK_BACKGROUND === "1";

    // if a background dev server started by "co start" is still running, stop it first
    // (skipped when this process itself is the background child spawned by "co start")
    if (!isBackground) {
        const { readState, isRunning, stopBackground, clearState } = await import("../utils/background");
        const backgroundState = await readState();
        if (backgroundState) {
            if (isRunning(backgroundState)) {
                consola.info(`A background cookbook dev server (pid ${backgroundState.pid}) is running. Stopping it first..`);
                await stopBackground(backgroundState);
            }
            await clearState();
        }
    } else {
        // When running as the background child of "co start", publish our pid
        // first so the parent can track liveness. On Windows the real pid is
        // not directly observable because the process is launched through a
        // hidden-console WScript wrapper.
        const { ensureCookbookDir } = await import("../utils/background");
        await writeFile(join(ensureCookbookDir(), "dev-pid.md"), `${process.pid}`, "utf-8");
        // drop stale worker statuses from a previous run; fresh states are
        // published by initWorkers / the workers themselves
        await rm(join(ensureCookbookDir(), "workers-status.json"), { force: true }).catch(() => {});
    }

    const cookbookToml = Bun.file(join(cwd(), "cookbook.toml"));
    if (!(await cookbookToml.exists())) {
        consola.error(`The "cookbook.toml" file does not exist in the current directory: ${join(cwd())}`);
        consola.info(`Hint: run "co init" in an empty directory to create a new cookbook project.`);
        exit(1);
    }

    const cookbookTomlText = await cookbookToml.text();
    const cookbookTomlHash = calcHash(cookbookTomlText);
    const options = await getCookbookToml(cookbookTomlText, progress);
    options.hash = cookbookTomlHash;

    const params = utils.getParams();
    const mode = await selectMode(options, params);

    if (isBackground) {
        const requestedSessionId = env.COOKBOOK_LOG_SESSION;
        const sessionId =
            typeof requestedSessionId === "string" && requestedSessionId.length > 0 ? requestedSessionId : createSession({ mode }).sessionId;
        installLogCollector({ source: "cookbook", sessionId, mirror: false });
    } else {
        // "co dev" in the foreground owns its session: it finalizes it when the
        // process exits (Ctrl+C / crash).
        const previous = readCurrentSession();
        if (previous) {
            writeSessionEvent(previous.sessionId, { source: "cookbook", stream: "system", text: "stopped by a new run", kind: "session-replaced" });
            finalizeSession(previous.sessionId, "replaced", "stopped by a new run");
        }
        const meta = createSession({ mode });
        installLogCollector({ source: "cookbook", sessionId: meta.sessionId, captureConsole: true, mirror: true, finalizeOnExit: true });
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

        const endTime = new Date();
        const time = Math.max(endTime.getTime() - startTime.getTime(), 0);
        await progress.close(chalk.gray("cookbook is ready."));
        console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Time taken: ") + chalk.hex("#24B56A")(`${time}ms`) + (time > 8192 ? chalk.gray(" (✨ cached! next start faster)") : ""));
        console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Current mode: ") + chalk.hex("#24B56A")(mode));
        console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Current mode: ") + chalk.hex("#24B56A")(mode));

        console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Base URL: ") + chalk.hex("#24B56A")(cookbookServerBaseUrl));

        console.log("");
    };

    void start(mode).catch((error) => {
        consola.error("Failed to start cookbook dev server:", error);
        exit(1);
    });

    const resolvers = Promise.withResolvers();
    await resolvers.promise; // let the never exit
});
