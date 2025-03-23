import { consola } from "consola";
import { platform } from "node:process";
import { execFileSync, type ExecFileSyncOptionsWithBufferEncoding } from "node:child_process";

export function execScript(script: string, options: ExecFileSyncOptionsWithBufferEncoding) {
  const shell = platform === "win32" ? "powershell.exe" : "bash";
  const shellOptions = platform === "win32" ? "-Command" : "-c";
  let scriptRaw = script;
  if (platform !== "win32") scriptRaw = `"${scriptRaw.replaceAll('"', '\\"')}"`;
  if (platform === "win32") scriptRaw = `$ErrorActionPreference = "Stop"; ${scriptRaw.replaceAll("&&", ";")}`;
  consola.start(scriptRaw);
  return execFileSync(shell, [shellOptions, scriptRaw], {
    shell: true,
    stdio: "inherit",
    ...options,
  });
}
