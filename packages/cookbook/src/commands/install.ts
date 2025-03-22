import { defineCookbookCommand } from "@milkio/cookbook-command";
import consola from "consola";
import { execFileSync } from "node:child_process";
import os from "node:os";

export default await defineCookbookCommand(async (utils) => {
  const cookbookToml = await utils.getCookbookToml();
  const params = utils.getParams();
  const platform = os.platform();
  const command = `${cookbookToml.general.packageManager} install ${params.raw.join(" ")}`;
  consola.start(command);
  execFileSync(platform === "win32" ? "powershell.exe" : "bash", ["-c", command], {
    shell: true,
    stdio: "inherit",
  });
});
