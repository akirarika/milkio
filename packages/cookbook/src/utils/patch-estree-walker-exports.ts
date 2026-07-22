import { exists, readdir } from "fs-extra";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import consola from "consola";

// estree-walker@3.0.3 的 package.json exports 只声明了 "import" 条件，
// 缺少 require/default。Node 的 CJS 加载（require）按 ["node", "require", "default"]
// 条件集解析 exports，找不到匹配时会抛 "No \"exports\" main defined"。
// Nuxt 通过 jiti 把 ESM 转译为 CJS require 时正是这条路径。
// 这里为所有有该缺陷的 estree-walker 副本（根目录与嵌套）补一个 "default" 条件，
// 复用现有的 import 目标（Node >= 22.12 已支持 require(ESM)，可以正常工作）。

async function listEstreeWalkerPackageJsons(root: string): Promise<Array<string>> {
  const nodeModules = join(root, "node_modules");
  const results: Array<string> = [];

  const rootCopy = join(nodeModules, "estree-walker", "package.json");
  if (await exists(rootCopy)) results.push(rootCopy);

  if (!(await exists(nodeModules))) return results;

  let entries: Array<string> = [];
  try {
    entries = await readdir(nodeModules);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    if (entry.startsWith("@")) {
      // 作用域包：node_modules/@scope/<pkg>/node_modules/estree-walker
      const scopeDir = join(nodeModules, entry);
      let scoped: Array<string> = [];
      try {
        scoped = await readdir(scopeDir);
      } catch {
        continue;
      }
      for (const pkg of scoped) {
        const candidate = join(scopeDir, pkg, "node_modules", "estree-walker", "package.json");
        if (await exists(candidate)) results.push(candidate);
      }
    } else {
      // 普通包：node_modules/<pkg>/node_modules/estree-walker
      const candidate = join(nodeModules, entry, "node_modules", "estree-walker", "package.json");
      if (await exists(candidate)) results.push(candidate);
    }
  }

  return results;
}

export async function ensureEstreeWalkerExportsPatched(root: string): Promise<void> {
  const packageJsonPaths = await listEstreeWalkerPackageJsons(root);
  for (const packageJsonPath of packageJsonPaths) {
    try {
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));
      const entry = packageJson?.exports?.["."];
      if (!entry || typeof entry !== "object") continue;
      // 已经有 require 或 default 条件，无需处理（例如 2.0.2 或修复后的版本）
      if (entry.default !== undefined || entry.require !== undefined) continue;
      if (entry.import === undefined) continue;

      // 保守地只补 default，紧跟在 import 之后，保持其余字段顺序不变
      const patchedEntry: Record<string, unknown> = {};
      for (const key of Object.keys(entry)) {
        patchedEntry[key] = entry[key];
        if (key === "import") patchedEntry.default = entry.import;
      }
      packageJson.exports["."] = patchedEntry;
      await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf-8");
      consola.info(`Patched estree-walker exports: added default condition (${packageJsonPath})`);
    } catch {
      // 文件损坏或不可写时跳过，不阻断主流程
    }
  }
}
