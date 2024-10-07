import { Glob } from "bun";
import { join } from "node:path";
import type { CookbookOptions } from "..";
import { exists } from "node:fs/promises";
import { checkPath } from "./utils";

export const commandSchema = async (options: CookbookOptions, paths: { cwd: string; milkio: string; generated: string }, project: CookbookOptions["projects"]["key"]) => {
  const scanner = join(paths.cwd, "commands");
  let files: AsyncIterableIterator<string> | Array<string> = [];
  if (await exists(scanner)) {
    const glob = new Glob("*.ts");
    files = glob.scan({ cwd: scanner, onlyFiles: true });
  }

  let typescriptImports = `/* eslint-disable */\n// command-schema`;
  let typescriptExports = "export default {";
  typescriptExports += "\n  commands: {";
  let len = 0;
  for await (let path of files) {
    path = path.replaceAll("\\", "/");
    const file = Bun.file(join(scanner, path));
    const fileUnit8Array = await file.text();
    if (!fileUnit8Array.includes("export default command({")) continue;
    checkPath(paths, path);

    const nameWithPath = path.slice(0, path.length - 3); // 3 === ".ts".length
    const name = nameWithPath.replaceAll("/", "$").replaceAll("-", "_");
    typescriptImports += `\nimport ${name} from "../../../commands/${nameWithPath}";`;
    typescriptExports += `\n    "${nameWithPath}": { module: ${name} },`;
    ++len;
  }
  typescriptExports += "\n  },";
  typescriptExports += `\n  len: ${len}`;
  typescriptExports += "\n}";
  const typescript = `${typescriptImports}\n\n${typescriptExports}`;
  await Bun.write(join(paths.cwd, ".milkio", "generated", "raw", "command-schema.ts"), typescript);
};
