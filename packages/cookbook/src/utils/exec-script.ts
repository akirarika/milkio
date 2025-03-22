import { consola } from "consola";
import { platform } from "node:process";
import { execFileSync, type ExecFileSyncOptionsWithBufferEncoding } from "node:child_process";

export function execScript(script: string, options: ExecFileSyncOptionsWithBufferEncoding) {
  const shell = platform === "win32" ? "powershell.exe" : "bash";
  const shellOptions = platform === "win32" ? "-Command" : "-c";
  consola.start(script);
  return execFileSync(shell, [shellOptions, script], {
    shell: true,
    stdio: "inherit",
    ...options,
  });
}
