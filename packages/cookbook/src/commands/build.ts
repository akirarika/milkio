import { defineCookbookCommand } from "@milkio/cookbook-command";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { join } from "node:path";
import { cwd, exit } from "node:process";
import consola from "consola";
import { execScript } from "../utils/exec-script";
import { selectMode } from "../utils/select-mode";
import { progress } from "../progress";
import { calcHash } from "../utils/calc-hash";

export default await defineCookbookCommand(async (utils) => {
    const cookbookToml = Bun.file(join(cwd(), "cookbook.toml"));
    if (!(await cookbookToml.exists())) {
        consola.error(`The "cookbook.toml" file does not exist in the current directory: ${join(cwd())}`);
        exit(0);
    }
    const cookbookTomlText = await cookbookToml.text();
    const cookbookTomlHash = calcHash(cookbookTomlText);
    const options = await getCookbookToml(cookbookTomlText, progress);
    options.hash = cookbookTomlHash;

    const params = utils.getParams();
    const mode = await selectMode(options);

    progress.open("cookbook building..");
    const { initWatcher } = await import("../watcher");
    await initWatcher(options, mode, false);
    progress.close("");

    for (const key in options.projects ?? []) {
        const project = options.projects[key];
        if (params.commands.length > 0 && !params.commands.includes(key)) continue;

        await execScript(`${project.build ?? `${options.general.packageManager} run build`}`, {
            cwd: join(cwd(), "projects", key),
            env: {
                COOKBOOK_MODE: mode,
            },
        });
    }

    consola.success("Cookbook builded!");
});
