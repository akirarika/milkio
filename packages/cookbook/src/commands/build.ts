import { defineCookbookCommand } from "@milkio/cookbook-command";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { generator } from "../generator";
import { join } from "node:path";
import { cwd } from "node:process";
import consola from "consola";
import { $ } from "bun";

export default await defineCookbookCommand(async (utils) => {
  consola.start("Cookbook building..");
  const options = await getCookbookToml();
  await generator.significant(options);
  await generator.insignificant(options);

  for (const key in options.projects) {
    const project = options.projects[key];
    await $`${project.build ?? `${options.general.packageManager} run build`}`.cwd(join(cwd(), "projects", key));
  }

  consola.success("Cookbook builded!");
});
