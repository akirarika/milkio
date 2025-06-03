import { cwd } from "node:process";
import { execScript } from "../utils/exec-script";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import { selectProject } from "../utils/select-project";
import { handleNonCookbookPkgMgr } from "../utils/handle-non-cookbook-pkg-mgr";

export default await defineCookbookCommand(async (utils) => {
  const params = utils.getParams();
  let pkgMgr = await handleNonCookbookPkgMgr();
  let path = cwd();

  if (!pkgMgr) {
    const cookbookToml = await utils.getCookbookToml();
    const params = utils.getParams();
    if (params.commands.length !== 0) {
      const project = await selectProject(cookbookToml, {
        withRoot: true,
      });
      path = project.path;
    }
    pkgMgr = cookbookToml.general.packageManager;
  }
  const command = `${pkgMgr} uninstall ${params.raw.join(" ")}`;
  await execScript(command, {
    cwd: path,
  });
});
