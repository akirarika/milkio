import { defineWatcherExtension } from "../extensions";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { exit } from "node:process";
import consola from "consola";

function fileNameToCamelCase(fileName: string): string {
  const segments = fileName.slice(0, -".cache.ts".length).split("-");
  let camelCase = segments[0] ?? "";
  for (let i = 1; i < segments.length; i++) {
    camelCase += segments[i]!.charAt(0).toUpperCase() + segments[i]!.slice(1);
  }
  return camelCase;
}

function fileNameToPascalCase(fileName: string): string {
  const camelCase = fileNameToCamelCase(fileName);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}

function requiresExportedType(content: string): boolean {
  return content.includes("defineMilkioKVCache") || content.includes("defineMilkioMemoCache");
}

/**
 * 校验每个 cache 文件是否遵循导出约定：
 *
 *   1. 位于模块的 `$caches` 目录下
 *   2. `foo-bar.cache.ts` 必须导出 `export const fooBarCache = defineMilkio...`
 *   3. KV / Memo 模型必须导出 `export type FooBarCache = ...`
 *
 * Bloom filter 没有泛型模型，因此不要求导出类型。
 */
export const cacheValidateWatcherExtension = defineWatcherExtension({
  async: false,

  filter: (file) => {
    return file.type === "cache";
  },

  setup: async (root, mode, options, project, changeFiles, allFiles) => {
    for (const file of allFiles) {
      // 最后一段是文件名，前面的是目录段
      const directoryParts = file.parts.slice(0, -1);
      if (!directoryParts.includes("$caches")) {
        consola.error(`[cache-validate] "${file.path}" must be placed under a $caches directory.`);
        exit(1);
      }

      const raw = await readFile(join(file.projectFsPath, file.path), "utf-8");
      const content = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      const camelCaseName = fileNameToCamelCase(file.fileName);
      if (!content.includes(`export const ${camelCaseName}Cache = defineMilkio`)) {
        consola.error(`[cache-validate] "${file.path}" must contain: export const ${camelCaseName}Cache = defineMilkio<Model>(...)`);
        exit(1);
      }

      const pascalCaseName = fileNameToPascalCase(file.fileName);
      if (requiresExportedType(content) && !content.includes(`export type ${pascalCaseName}Cache`)) {
        consola.error(`[cache-validate] "${file.path}" must declare: export type ${pascalCaseName}Cache = ...`);
        exit(1);
      }
    }
  },
});
