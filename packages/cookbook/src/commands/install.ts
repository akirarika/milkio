import { execScript } from "../utils/exec-script";
import { defineCookbookCommand } from "@milkio/cookbook-command";

export default await defineCookbookCommand(async (utils) => {
  const cookbookToml = await utils.getCookbookToml();
  const params = utils.getParams();
  const command = `${cookbookToml.general.packageManager} install ${params.raw.join(" ")}`;
  execScript(command, {});
});
