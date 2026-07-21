import { spawn } from "node:child_process";
import { exit } from "node:process";
import consola from "consola";

/** Resolve a runtime executable path; returns null if not found. */
function which(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(
      process.platform === "win32" ? "where" : "which",
      [command],
      { stdio: ["ignore", "pipe", "ignore"] }
    );
    let out = "";
    child.stdout?.on("data", (d: Buffer) => { out += d.toString(); });
    child.on("close", (code) => {
      if (code === 0 && out.trim()) resolve(out.trim().split("\n")[0].trim());
      else resolve(null);
    });
    child.on("error", () => resolve(null));
  });
}

// 缓存两个运行时的可用性状态
let runtimeAvailability: null | Promise<{ node: boolean; bun: boolean }> = null;

export async function getRuntime(preferredRuntime: "node" | "bun" = "node"): Promise<"node" | "bun"> {
  if (!runtimeAvailability) {
    runtimeAvailability = (async () => {
      const [nodePath, bunPath] = await Promise.all([
        which("node"),
        which("bun"),
      ]);
      return {
        node: nodePath !== null,
        bun: process.execPath?.includes("bun") || bunPath !== null,
      };
    })();
  }

  const { node, bun } = await runtimeAvailability;

  if (preferredRuntime === "node" && node) {
    return "node";
  }
  if (preferredRuntime === "bun" && bun) {
    return "bun";
  }

  if (node) {
    return "node";
  }
  if (bun) {
    return "bun";
  }

  consola.error("Please install Node.js or Bun.js");
  exit(1);
}
