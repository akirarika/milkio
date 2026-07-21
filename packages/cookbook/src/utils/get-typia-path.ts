import consola from "consola";
import { join } from "node:path";
import { cwd } from "node:process";
import { exists } from "node:fs/promises";
import { exit } from "node:process";

let typiaPath: Promise<string> | null = null;

export function getTypiaPath(): Promise<string> {
  if (typiaPath) return typiaPath;
  typiaPath = (async () => {
    let typiaPath = join(cwd(), "./node_modules/typia/lib/executable/typia.js");
    // check if typia is installed in the project, if not, try to find it in the global node_modules
    if (!(await exists(typiaPath))) typiaPath = join(cwd(), "../../node_modules/typia/lib/executable/typia.js");
    if (!(await exists(typiaPath))) {
      consola.error(`Typia is not installed, so it cannot be found in the following path: ${typiaPath}`);
      exit(1);
    }
    return typiaPath;
  })();
  return typiaPath;
}
