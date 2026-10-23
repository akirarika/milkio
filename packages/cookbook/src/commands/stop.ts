import { defineCookbookCommand } from "@milkio/cookbook-command";
import consola from "consola";
import { clearState, isPidAlive, isRunning, killProcessTree, readState, stopBackground } from "../utils/background";
import { finalizeSession, readCurrentSession, updateSessionMeta } from "../logs/session";
import { installLogCollector } from "../logs/collector";

export default await defineCookbookCommand(async () => {
    const state = await readState();
    const current = readCurrentSession();
    if (!state && !current) {
        consola.info("No background cookbook dev server is running.");
        return;
    }

    // Attach to the session before stopping it so the "session-end" event and
    // the final console output are part of the run's log.
    const collector = current
        ? installLogCollector({
              source: "co:stop",
              sessionId: current.sessionId,
              captureConsole: true,
              mirror: true,
              finalizeOnExit: false,
              installProcessHooks: false,
              announceSessionStart: false,
          })
        : undefined;

    const wasRunning = state ? isRunning(state) : false;
    try {
        if (state) {
            if (wasRunning) {
                await stopBackground(state);
            }
            await clearState();
        } else if (current && isPidAlive(current.pid)) {
            // no "up-state.json" but a live session pointer (e.g. a background
            // test process): stop the owning process directly
            await killProcessTree(current.pid);
        }

        if (collector && current) {
            try {
                collector.event("cookbook", "info", "session stopped by co stop", { kind: "session-end", meta: { pid: state?.pid ?? current.pid } });
                collector.flushSync();
            } catch {}
            // installing the collector set meta.pid to this (short-lived) stop
            // process; restore the actual session owner pid for post-mortem
            updateSessionMeta(current.sessionId, { pid: current.pid });
            finalizeSession(current.sessionId, "ended", "stopped by co stop");
        }
    } finally {
        try {
            collector?.close();
        } catch {}
    }

    if (state) {
        if (wasRunning) {
            consola.success(`Stopped the background cookbook dev server (pid ${state.pid}).`);
        } else {
            consola.info("The background cookbook dev server is not running (cleaned up stale state).");
        }
        return;
    }
    if (current) {
        consola.success(`Stopped the background cookbook dev server (pid ${current.pid}).`);
    }
});
