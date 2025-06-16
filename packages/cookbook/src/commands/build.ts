import { defineCookbookCommand } from "@milkio/cookbook-command";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { generator } from "../generator";
import { join } from "node:path";
import { cwd } from "node:process";
import consola from "consola";
import { execScript } from "../utils/exec-script";
import fs from "fs-extra";
import { selectMode } from "../utils/select-mode";

export default await defineCookbookCommand(async (utils) => {
  consola.start("Cookbook building..");
  const options = await getCookbookToml();

  for (const key in options.projects) {
    const project = options.projects[key];
    if (project.type === "milkio") await fs.remove(join(cwd(), "projects", ".milkio"));
    project.typiaMode = "generation";
  }

  await generator.watcher(options, await selectMode(options));

  for (const key in options.projects) {
    const project = options.projects[key];
    await execScript(`${project.build ?? `${options.general.packageManager} run build`}`, {
      cwd: join(cwd(), "projects", key),
    });
  }

  consola.success("Cookbook builded!");
});
