import { defineCookbookCommand } from "@milkio/cookbook-command";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { join } from "node:path";
import { cwd } from "node:process";
import consola from "consola";
import { execScript } from "../utils/exec-script";
import { selectMode } from "../utils/select-mode";

export default await defineCookbookCommand(async (utils) => {
  const options = await getCookbookToml();

  const mode = await selectMode(options);

  consola.start("cookbook building..");
  const { initWatcher } = await import("../watcher");
  await initWatcher(options, mode, false);

  for (const key in options.projects) {
    const project = options.projects[key];
    await execScript(`${project.build ?? `${options.general.packageManager} run build`}`, {
      cwd: join(cwd(), "projects", key),
    });
  }

  consola.success("Cookbook builded!");
});
