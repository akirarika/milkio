import consola from "consola";
import { join } from "node:path";
import { cwd } from "node:process";
import { exists } from "node:fs/promises";
import { exit } from "node:process";
import { ensureTypiaExportsPatched } from "./patch-typia-exports";

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
    // typia is resolved through this function by every dev/start/test run, so
    // this is a reliable choke point to keep its exports patch applied
    await ensureTypiaExportsPatched(join(typiaPath, "..", "..", "..", "package.json"));
    return typiaPath;
  })();
  return typiaPath;
}
