import { defineCookbookCommand } from "@milkio/cookbook-command";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { join } from "node:path";
import { cwd } from "node:process";
import consola from "consola";
import { execScript } from "../utils/exec-script";
import { selectMode } from "../utils/select-mode";
import { progress } from "../progress";

export default await defineCookbookCommand(async (utils) => {
  const options = await getCookbookToml();
  const params = utils.getParams();

  const mode = await selectMode(options);

  progress.open("cookbook building..");
  const { initWatcher } = await import("../watcher");
  await initWatcher(options, mode, false);
  progress.close("");

  for (const key in options.projects) {
    const project = options.projects[key];
    if (params.commands.length > 0 && !params.commands.includes(key)) continue;

    await execScript(`${project.build ?? `${options.general.packageManager} run build`}`, {
      cwd: join(cwd(), "projects", key),
    });
  }

  consola.success("Cookbook builded!");
});
