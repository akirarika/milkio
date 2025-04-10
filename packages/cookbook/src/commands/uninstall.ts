import { cwd } from "node:process";
import { execScript } from "../utils/exec-script";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import { selectProject } from "../utils/select-project";

export default await defineCookbookCommand(async (utils) => {
  const cookbookToml = await utils.getCookbookToml();
  const params = utils.getParams();
  let path = cwd();
  if (params.commands.length !== 0) {
    const project = await selectProject(cookbookToml, {
      withRoot: true
    })
    path = project.path
  }
  const command = `${cookbookToml.general.packageManager} uninstall ${params.raw.join(" ")}`;
  execScript(command, {
    cwd: path,
  });
});
