import { consola } from "consola";
import { cwd, platform } from "node:process";
import { execFileSync, type ExecFileSyncOptionsWithBufferEncoding } from "node:child_process";
import { $ } from "bun";

export async function execScript(script: string, options: ExecFileSyncOptionsWithBufferEncoding) {
  // const shell = platform === "win32" ? "powershell.exe" : "bash";
  // const shellOptions = platform === "win32" ? "-Command" : "-c";
  // let scriptRaw = script;
  // let scriptDisplay = scriptRaw;

  // if (platform === "win32") scriptDisplay = `${scriptRaw.replaceAll("&&", ";")}`;
  // consola.start(`${scriptDisplay}`);

  // if (platform === "win32") scriptRaw = `$ErrorActionPreference = "Stop"; ${scriptRaw.replaceAll("&&", ";")}`;
  // scriptRaw = `"${scriptRaw.replaceAll('"', '\\"')}"`.trim();
  // return execFileSync(shell, [shellOptions, scriptRaw], {
  //   shell: true,
  //   stdio: "inherit",
  //   ...options,
  // });
  await $`${{ raw: script }}`.cwd(`${options.cwd}` || cwd());
}
