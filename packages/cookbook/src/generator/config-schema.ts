import { Glob } from "bun";
import { join } from "node:path";
import { exists } from "node:fs/promises";
import type { CookbookOptions } from "../utils/cookbook-dto-types";
import consola from "consola";
import { progress } from "../progress";
import { getMode } from "../utils/get-mode";

export async function configSchema(options: CookbookOptions, paths: { cwd: string; milkio: string; generated: string }, project: CookbookOptions["projects"]["key"]) {
  const mode = getMode();
  const scanner = join(paths.cwd);
  let modeFiles: AsyncIterableIterator<string> | Array<string> = [];
  let globalModeFiles: AsyncIterableIterator<string> | Array<string> = [];
  if (await exists(scanner)) {
    modeFiles = new Glob(`{config,configs,service,controller}/**/{${mode},*.${mode}}.config.ts`).scan({ cwd: scanner, onlyFiles: true });
    globalModeFiles = new Glob("{config,configs,service,controller}/**/{global,*.global}.config.ts").scan({ cwd: scanner, onlyFiles: true });
  }

  let typescriptImports = "/* eslint-disable */\n// config-schema";
  let typescriptExports = `const mode = "${mode}";`;
  typescriptExports += "\n\nexport const configSchema = { get: async () => {\n  return {";

  for await (let path of globalModeFiles) {
    path = path.replaceAll("\\", "/");
    let nameWithPath = path.slice(0, path.length - 10); // 10 === ".config.ts".length
    if (nameWithPath.endsWith("/index") || nameWithPath === "index") nameWithPath = nameWithPath.slice(0, nameWithPath.length - 5); // 5 === "index".length
    const name = path
      .slice(0, path.length - 10)
      .replaceAll("/", "__")
      .replaceAll("-", "_")
      .replaceAll(".config.ts", "")
      .split("/")
      .at(-1);
    typescriptImports += `\nimport ${name} from "../${nameWithPath}.config";`;
    typescriptExports += `\n    // @ts-expect-error\n    ...(await ${name}(mode)),`;
  }
  for await (let path of modeFiles) {
    path = path.replaceAll("\\", "/");
    let nameWithPath = path.slice(0, path.length - 10); // 10 === ".config.ts".length
    if (nameWithPath.endsWith("/index") || nameWithPath === "index") nameWithPath = nameWithPath.slice(0, nameWithPath.length - 5); // 5 === "index".length
    const name = path
      .slice(0, path.length - 10)
      .replaceAll("/", "__")
      .replaceAll("-", "_")
      .replaceAll(".config.ts", "")
      .split("/")
      .at(-1);
    typescriptImports += `\nimport ${name} from "../${nameWithPath}.config";`;
    typescriptExports += `\n    // @ts-expect-error\n    ...(await ${name}(mode)),`;
  }
  typescriptExports += "\n  }\n}}";
  const typescript = `${typescriptImports}\n\n${typescriptExports}`;
  await Bun.write(join(paths.cwd, ".milkio", "config-schema.ts"), typescript);

  progress.rate++;
  if (progress.rate > 1000) progress.rate = 1000;
}
