import { $ } from "bun";
import consola from "consola";
import { join, dirname } from "node:path";
import { defineWatcherExtension } from "../extensions";
import { exists, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { calcHash } from "../../utils/calc-hash";
import { getRuntime } from "../../utils/get-runtime";
import { getTypiaPath } from "../../utils/get-typia-path";
import { getLatestSchemaFolder } from "../../utils/get-latest-schema-folder.ts";

async function processFileImports(filePath: string, projectFsPath: string, root: string) {
  const content = await readFile(filePath, "utf-8");
  const normalizedRoot = `${root.replace(/\\/g, "/").replace(/\/$/, "")}/`;
  const fileDir = dirname(filePath);

  let result = "";
  let inTopArea = true;

  for (const line of content.split("\n")) {
    if (!inTopArea) {
      result += `${line}\n`;
      continue;
    }

    const codeLine = line.split("//")[0].trimEnd();
    if (codeLine.includes("/*")) {
      result += `${line}\n`;
      inTopArea = false;
      continue;
    }

    const importMatch = codeLine.match(/^\s*(import|export)(?:\s+[\w*{},\s]+)?\s+from\s+['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/);
    if (importMatch) {
      const importPath = importMatch[2] || importMatch[3];
      if (importPath?.startsWith(".")) {
        const absoluteImportPath = join(fileDir, importPath).replace(/\\/g, "/");
        const projectImportPath = absoluteImportPath.replace(normalizedRoot, "/");

        const newLine = line.replace(importPath, `../../../../..${projectImportPath.startsWith("//") ? projectImportPath.slice(1) : projectImportPath}`);
        result += `${newLine}\n`;
      } else {
        result += `${line}\n`;
      }
    } else if (codeLine.trim() === "") {
      result += `${line}\n`;
    } else {
      result += `${line}\n`;
      inTopArea = false;
    }
  }

  return result;
}

export const typiaWatcherExtension = defineWatcherExtension({
  async: true,
  filter: (file) => file.type === "typia",
  setup: async (root, mode, options, project, changeFiles, allFiles) => {
    const milkioDirPath = join(root, ".milkio");
    const milkioGeneratedDirPath = join(milkioDirPath, "generated");
    const milkioTranspiledDirPath = join(milkioDirPath, "transpiled");
    const milkioGeneratedTypiaDirPath = join(milkioGeneratedDirPath, "typia");
    const milkioTranspiledTypiaDirPath = join(milkioTranspiledDirPath, "typia");

    await Promise.all([mkdir(milkioGeneratedDirPath, { recursive: true }), mkdir(milkioTranspiledDirPath, { recursive: true }), mkdir(milkioGeneratedTypiaDirPath, { recursive: true }), mkdir(milkioTranspiledTypiaDirPath, { recursive: true })]);

    const buildTasks: Array<Promise<any>> = [];
    const hashes: Map<string, string> = new Map();

    for (const file of changeFiles) {
      buildTasks.push(
        (async () => {
          const sourceFilePath = join(file.projectFsPath, file.path);

          const processedContent = await processFileImports(sourceFilePath, file.projectFsPath, root);

          const hash = calcHash(Buffer.from(processedContent));
          hashes.set(file.importName, hash);

          const generatedFilePath = join(milkioGeneratedTypiaDirPath, file.importName, hash, "schema.ts");
          const transpiledDirPath = join(milkioTranspiledTypiaDirPath, file.importName, hash);

          await Promise.all([mkdir(dirname(generatedFilePath), { recursive: true }), mkdir(transpiledDirPath, { recursive: true })]);

          await writeFile(generatedFilePath, processedContent, "utf-8");

          const deleteTasks: Array<Promise<void>> = [];
          const paths = [join(milkioGeneratedTypiaDirPath, file.importName), join(milkioTranspiledTypiaDirPath, file.importName)];

          for (const path of paths) {
            if (await exists(path)) {
              for (const oldHash of await readdir(path)) {
                if (oldHash !== hash) {
                  deleteTasks.push(rm(join(path, oldHash), { recursive: true, force: true }));
                }
              }
            }
          }

          await Promise.all(deleteTasks);

          buildTasks.push($`${await getRuntime()} ${await getTypiaPath()} generate --input ${join(milkioGeneratedTypiaDirPath, file.importName, hash)} --output ${transpiledDirPath} --project ${join(root, "tsconfig.json")}`.quiet().cwd(root));
        })(),
      );
    }

    await Promise.all(buildTasks);

    const cleanupTasks: Array<Promise<void>> = [];
    const validImportNames = new Set(allFiles.map((file) => file.importName));

    for (const subDir of ["generated", "transpiled"]) {
      const typeDir = join(milkioDirPath, subDir, "typia");
      if (await exists(typeDir)) {
        for (const importName of await readdir(typeDir)) {
          if (!validImportNames.has(importName)) {
            cleanupTasks.push(rm(join(typeDir, importName), { recursive: true, force: true }));
          }
        }
      }
    }

    await Promise.all(cleanupTasks);

    const properties: string[] = [];
    const propertyNames = new Map<string, string>();

    for (const file of allFiles) {
      const fileName =
        file.path
          .split("/")
          .pop()
          ?.replace(/\.typia\.ts$/, "") || "";
      const camelCaseName = `use${fileName.replace(/^[a-z]/, (match) => match.toUpperCase()).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())}`;

      if (propertyNames.has(camelCaseName)) {
        consola.warn(`Duplicate camelCase property name '${camelCaseName}' detected for files: '${file.path}' and '${propertyNames.get(camelCaseName)}'`);
      } else {
        propertyNames.set(camelCaseName, file.path);
      }

      let hash = hashes.get(file.importName);
      if (!hash) {
        const generatedDir = join(milkioGeneratedTypiaDirPath, file.importName);
        if (await exists(generatedDir)) {
          const latestDir = await getLatestSchemaFolder(generatedDir);
          if (latestDir) hash = latestDir;
        }
      }

      if (hash) {
        properties.push(`  ${camelCaseName}: async () => (await import("./transpiled/typia/${file.importName}/${hash}/schema.ts")),`);
      }
    }

    const typiaSchemaContent = ["export default {", ...properties, "};", ""].join("\n");

    await Bun.write(join(milkioDirPath, "typia-schema.ts"), typiaSchemaContent);
  },
});
