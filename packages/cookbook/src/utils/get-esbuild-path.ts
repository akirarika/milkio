import consola from "consola";
import { join } from "node:path";
import { cwd } from "node:process";
import { exists } from "node:fs/promises";
import { exit } from "node:process";

let esbuildPath: Promise<string> | null = null;

export function getEsbuildPath(): Promise<string> {
  if (esbuildPath) return esbuildPath;

  esbuildPath = (async () => {
    let esbuildPath = join(cwd(), "./node_modules/esbuild/bin/esbuild");
    // check if esbuild is installed in the project, if not, try to find it in the global node_modules
    if (!(await exists(esbuildPath))) esbuildPath = join(cwd(), "../../node_modules/esbuild/bin/esbuild");
    if (!(await exists(esbuildPath))) {
      consola.error(`Esbuild is not installed, so it cannot be found in the following path: ${esbuildPath}`);
      exit(1);
    }
    return esbuildPath;
  })();

  return esbuildPath;
}
