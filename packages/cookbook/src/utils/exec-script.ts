import { consola } from "consola";
import { platform } from "node:process";
import type { ExecFileSyncOptionsWithBufferEncoding } from "node:child_process";
import { Buffer } from "node:buffer";

export function execScript(script: string, options: ExecFileSyncOptionsWithBufferEncoding) {
  const isWin = platform === "win32";
  const shell = isWin ? "powershell.exe" : "bash";
  const shellOption = isWin ? "-Command" : "-c";

  let scriptRaw = script;
  let scriptDisplay = scriptRaw;

  if (isWin) {
    scriptDisplay = `${scriptRaw.replaceAll("&&", ";")}`;
  }
  consola.start(`${scriptDisplay}`);

  if (isWin) {
    scriptRaw = `$ErrorActionPreference = "Stop"; ${scriptRaw.replaceAll("&&", ";")}`;
  }

  const proc = Bun.spawnSync({
    cmd: [shell, shellOption, scriptRaw],
    cwd: options.cwd as string,
    env: {
      ...process.env,
      ...options.env,
      ...(process.stdout.isTTY
        ? {
            TERM: process.env.TERM || "xterm-256color",
            COLORTERM: process.env.COLORTERM || "1",
          }
        : {}),
    },
    stdio: ["inherit", "inherit", "inherit"],
    tty: true,
  });

  if (!proc.success) consola.error(`Command failed with exit code ${proc.exitCode}`);

  return Buffer.from(proc.stdout || "");
}
