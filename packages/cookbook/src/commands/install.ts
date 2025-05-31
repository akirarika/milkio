import { cwd, exit } from "node:process";
import { execScript } from "../utils/exec-script";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import { selectProject } from "../utils/select-project";
import consola from "consola";

export default await defineCookbookCommand(async (utils) => {
  const cookbookToml = await utils.getCookbookToml();
  const params = utils.getParams();
  let path = cwd();
  if (params.commands.length !== 0) {
    const project = await selectProject(cookbookToml, {
      withRoot: true,
    });
    if (
      project.value !== "<root>" &&
      params.commands.find((command) => {
        if (command === "milkio") return true;
        if (command.startsWith("@milkio/")) return true;
        if (command === "typescript") return true;
        if (command === "@biomejs/biome") return true;
        if (command === "typia") return true;
        if (command === "vitest") return true;
        if (command === "jest") return true;
        if (command === "eslint") return true;
        return false;
      })
    ) {
      consola.warn(
        "You seem to be installing milkio-related packages or some common public packages. We recommend that you install these packages in the root directory so that you can upgrade all monorepo packages uniformly. Otherwise, it may be painful for you to upgrade these public package versions for each monorepo in the future.",
      );
      if (!(await consola.prompt(`🐱 Now, do you still want to install these packages in ${project.value} instead of the root directory?`, { type: "confirm" }))) {
        consola.success("Installation cancelled. You can choose the location <root> during installation.");
        exit(0);
      }
    }
    path = project.path;
  }
  const command = `${cookbookToml.general.packageManager} install ${params.raw.join(" ")}`;
  await execScript(command, {
    cwd: path,
  });
});
