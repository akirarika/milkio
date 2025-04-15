import { Glob } from "bun";
import consola from "consola";
import { join } from "node:path";
import { exists, mkdir } from "node:fs/promises";
import { exit } from "node:process";
import type { CookbookOptions } from "../utils/cookbook-dto-types";
import { checkPath } from "./utils";
import { progress } from "../progress";

export async function handlerSchema(options: CookbookOptions, paths: { cwd: string; milkio: string; generated: string }, project: CookbookOptions["projects"]["key"]) {
  if (!paths.milkio) return;

  let typiaPath = join(paths.cwd, "./node_modules/typia/lib/executable/typia.js");
  if (!(await exists(typiaPath))) typiaPath = join(paths.cwd, "../../node_modules/typia/lib/executable/typia.js");
  if (!(await exists(typiaPath))) {
    consola.error(`Typia is not installed, so it cannot be found in the following path: ${typiaPath}`);
    exit(1);
  }

  const scanner = join(paths.cwd);
  if (!(await exists(scanner))) {
    consola.error(`The directory does not exist: ${scanner}`);
    exit(1);
  }
  const glob = new Glob("{service,controller,handler}/**/*.handler.ts");
  const filesAsyncGenerator = glob.scan({ cwd: scanner, onlyFiles: true });

  let typescriptImports = "/* eslint-disable */\n// handler-schema";
  let typescriptExports = "export default {";
  typescriptExports += "\n  loadHandlers:(world: any) => ([";
  let len = 0;
  for await (let path of filesAsyncGenerator) {
    path = path.replaceAll("\\", "/");
    checkPath(paths, path, "handler");

    const nameWithPath = path.slice(0, path.length - 3); // 3 === ".ts".length
    const name = nameWithPath.replaceAll("/", "__").replaceAll("-", "_").replaceAll(".", "$");
    typescriptImports += `\nimport ${name} from "../${nameWithPath}";`;
    typescriptExports += `\n    ${name}(world),`;
    ++len;
  }
  typescriptExports += "\n  ]),";
  typescriptExports += "\n}";
  const typescript = `${typescriptImports}\n\n${typescriptExports}`;
  await Bun.write(join(paths.cwd, ".milkio", "handler-schema.ts"), typescript);

  progress.rate++;
  if (progress.rate > 1000) progress.rate = 1000;
}
