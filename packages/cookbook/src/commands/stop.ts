import { defineCookbookCommand } from "@milkio/cookbook-command";
import consola from "consola";
import { clearState, isRunning, readState, stopBackground } from "../utils/background";

export default await defineCookbookCommand(async (utils) => {
    const state = await readState();
    if (!state) {
        consola.info("No background cookbook dev server is running.");
        return;
    }
    if (!isRunning(state)) {
        await clearState();
        consola.info("The background cookbook dev server is not running (cleaned up stale state).");
        return;
    }
    await stopBackground(state);
    await clearState();
    consola.success(`Stopped the background cookbook dev server (pid ${state.pid}).`);
});
