import { $ } from "bun";
import { exit } from "node:process";
import consola from "consola";

let runtime: null | Promise<"node" | "bun"> = null;

export function getRuntime(): Promise<"node" | "bun"> {
  if (runtime) return runtime;
  runtime = (async () => {
    let runtime = "node";
    try {
      await $`node --version`.quiet();
    } catch (error) {
      runtime = "bun";
      try {
        await $`bun --version`.quiet();
      } catch (error) {
        consola.error("Please install Node.js or Bun.js");
        exit(1);
      }
    }

    return runtime as "node" | "bun";
  })();

  return runtime;
}
