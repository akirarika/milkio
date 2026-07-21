import { exec, spawn } from "node:child_process";
import { platform } from "node:process";

/**
 * Kill the process occupying a port. On Windows, uses netstat + taskkill
 * with windowsHide to prevent console window flashes.
 */
export async function killPort(port: number): Promise<void> {
  if (platform === "win32") {
    // Use netstat to find the PID, then taskkill. Do NOT use windowsHide:
    // children must inherit the (possibly hidden) parent console, otherwise
    // each spawned console app creates its own visible console window.
    const pid = await new Promise<string | null>((resolve) => {
      const child = spawn("netstat", ["-ano"], {
        stdio: ["ignore", "pipe", "ignore"],
      });
      let buf = "";
      child.stdout?.on("data", (d: Buffer) => { buf += d.toString(); });
      child.on("close", () => {
        for (const line of buf.split("\n")) {
          if (line.includes(`:${port}`) && line.includes("LISTENING")) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && /^\d+$/.test(pid)) {
              resolve(pid);
              return;
            }
          }
        }
        resolve(null);
      });
    });
    if (pid) {
      await new Promise<void>((resolve) => {
        const killer = spawn("taskkill", ["/PID", pid, "/F"], {
          stdio: "ignore",
        });
        killer.on("exit", () => resolve());
        killer.on("error", () => resolve());
      });
    }
    return;
  }

  // On Unix: use lsof + kill
  const pid = await new Promise<string | null>((resolve) => {
    exec(`lsof -ti tcp:${port}`, (err, stdout) => {
      if (err) { resolve(null); return; }
      resolve(stdout.trim() || null);
    });
  });
  if (pid) {
    await new Promise<void>((resolve) => {
      const killer = spawn("kill", ["-9", pid], {
        stdio: "ignore",
      });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
    });
  }
}
