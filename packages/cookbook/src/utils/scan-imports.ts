import consola from "consola";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

type ImportMap = Map<string, Set<string>>;

export async function analyzeImports(entryPaths: string[], cwd: string): Promise<ImportMap> {
  const directImportsCache = new Map<string, Set<string>>();
  const resultMap = new Map<string, Set<string>>();

  const resolveImportPath = (importPath: string, importerDir: string): string | null => {
    if (importPath.startsWith(".")) {
      const resolved = path.resolve(importerDir, importPath);
      return resolved.endsWith(".ts") ? resolved : `${resolved}.ts`;
    }

    if (importPath.startsWith("/") || importPath.startsWith("~/") || importPath.startsWith("@/")) {
      const normalized = importPath.replace(/^(~|@)\//, "/");
      const resolved = path.resolve(cwd, normalized.slice(1));
      return resolved.endsWith(".ts") ? resolved : `${resolved}.ts`;
    }

    return null;
  };

  const getDirectImports = async (filePath: string): Promise<Set<string>> => {
    if (directImportsCache.has(filePath)) {
      return directImportsCache.get(filePath)!;
    }

    const imports = new Set<string>();
    directImportsCache.set(filePath, imports);

    if (filePath.includes(".milkio") || filePath.includes("node_modules")) {
      return imports;
    }

    try {
      const fileStream = fs.createReadStream(filePath, { encoding: "utf8" });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Number.POSITIVE_INFINITY,
      });

      for await (const line of rl) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("//")) continue;

        if (trimmed.startsWith("/*") || !trimmed.startsWith("import")) {
          break;
        }

        const match = line.match(/from\s+["']([^"']+)["']/);
        if (match) {
          const importPath = match[1];
          const importerDir = path.dirname(filePath);
          const resolved = resolveImportPath(importPath, importerDir);

          if (resolved?.endsWith(".ts") && !resolved.includes(".milkio") && !resolved.includes("node_modules")) {
            imports.add(resolved);
          }
        }
      }

      await new Promise((resolve) => {
        fileStream.on("close", resolve);
        rl.close();
      });
    } catch (error) {
      consola.warn(`Failed to read file ${filePath}:`, error);
    }

    return imports;
  };

  const traverse = async (startPath: string, resultSet: Set<string>) => {
    const visited = new Set<string>();
    const queue: string[] = [startPath];
    visited.add(startPath);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const imports = await getDirectImports(current);

      for (const imp of imports) {
        if (!visited.has(imp)) {
          visited.add(imp);
          resultSet.add(imp);
          queue.push(imp);
        }
      }
    }
  };

  await Promise.all(
    entryPaths.map(async (entry) => {
      const entryPath = path.resolve(cwd, entry);
      const importsSet = new Set<string>();
      resultMap.set(entry, importsSet);
      await traverse(entryPath, importsSet);
    }),
  );

  return resultMap;
}
