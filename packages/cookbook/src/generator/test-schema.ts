import { Glob } from "bun";
import consola from "consola";
import { join } from "node:path";
import type { CookbookOptions } from "..";
import { exists } from "node:fs/promises";
import { exit, cwd } from "node:process";

export const testSchema = async (options: CookbookOptions, paths: { cwd: string; milkio: string; generated: string }, project: CookbookOptions["projects"]["key"]) => {
  const scanner = join(paths.cwd);
  let files: AsyncIterableIterator<string> | Array<string> = [];
  if (await exists(scanner)) {
    const glob = new Glob("**/*.test.ts");
    files = glob.scan({ cwd: scanner, onlyFiles: true });
  }

  let typescriptImports = `/* eslint-disable */\n// test-schema`;
  let typescriptExports = "export default {";
  for await (let path of files) {
    path = path.replaceAll("\\", "/");
    // const file = Bun.file(join(scanner, path));
    // const fileUnit8Array = await file.text();
    // if (!fileUnit8Array.includes("export default [")) continue;
    if (!/^[a-z0-9/$/-]+$/.test(path.slice(0, -8))) {
      consola.error(`Invalid path: "${join(cwd(), path)}". The path can only contain lowercase letters, numbers, and "-".\n`);
      exit(1);
    }

    let nameWithPath = path.slice(0, path.length - 8); // 8 === ".test.ts".length
    if (nameWithPath.endsWith("/index") || nameWithPath === "index") nameWithPath = nameWithPath.slice(0, nameWithPath.length - 5); // 5 === "index".length
    const name = path
      .slice(0, path.length - 8)
      .replaceAll("/", "$")
      .replaceAll("-", "_")
      .replaceAll(".test.ts", "");
    typescriptExports += `\n  "/${nameWithPath}": {},`;
  }
  typescriptExports += "\n}";
  const typescript = `${typescriptImports}\n\n${typescriptExports}`;
  await Bun.write(join(paths.cwd, ".milkio", "generated", "raw", "test-schema.ts"), typescript);
};
