import { $ } from "bun";
import { exit } from "node:process";
import consola from "consola";

// 缓存两个运行时的可用性状态
let runtimeAvailability: null | Promise<{ node: boolean; bun: boolean }> = null;

export async function getRuntime(preferredRuntime: "node" | "bun" = "node"): Promise<"node" | "bun"> {
  if (!runtimeAvailability) {
    runtimeAvailability = (async () => {
      let nodeAvailable = false;
      let bunAvailable = false;
      
      // Check Node.js
      try {
        await $`node --version`.quiet();
        nodeAvailable = true;
      } catch {
        // Node.js not available
      }
      
      // Check Bun
      try {
        await $`bun --version`.quiet();
        bunAvailable = true;
      } catch {
        // Bun not available
      }
      
      return {
        node: nodeAvailable,
        bun: bunAvailable
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
