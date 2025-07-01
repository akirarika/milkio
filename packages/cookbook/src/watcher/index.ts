import { watch, type FSWatcher } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { exists, mkdir, readdir, rm } from "node:fs/promises";
import { cwd, exit } from "node:process";
import type { CookbookOptions } from "../utils/cookbook-dto-types.ts";
import { Glob } from "bun";
import type { CookbookWatcherExtensionProject, CookbookWatcherFile, defineWatcherExtension } from "./extensions.ts";
import consola from "consola";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { imports, indexTs } from "./extensions/__IMPORTS__.ts";
import { __VERSION__ } from "../../__VERSION__.ts";
import chalk from "chalk";
import { getRate } from "../progress/index.ts";

const allFiles: Map<string, Map<string, CookbookWatcherFile>> = new Map();
const dependencyCache = new Map<string, Set<string>>();
const reverseDependencyGraph = new Map<string, Set<string>>();
export async function initWatcher(options: CookbookOptions, mode: string, watch: boolean) {
  const watchers: FSWatcher[] = [];
  const dispose = () => {
    for (const watcher of watchers) watcher.close();
  };

  try {
    const tasks: Array<Promise<void>> = [];
    for (const projectName in options.projects) {
      tasks.push(
        (async () => {
          const project = options.projects[projectName];
          const root = join(cwd(), "projects", projectName);
          if (project.type !== "milkio") return;
          if (!(await exists(root))) return;
          if (!(await exists(join(root, ".milkio")))) await mkdir(join(root, ".milkio"));

          const appRoot = join(root, "app");
          if (!(await exists(appRoot))) return;

          const entries = await readdir(appRoot, { withFileTypes: true });
          const validDirs = entries
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name)
            .filter((name) => !name.startsWith(".") && name !== "node_modules");

          await initializeProject(mode, root, appRoot, validDirs, options, project);

          if (watch) {
            const watcher = setupWatcher(mode, root, appRoot, validDirs, options, project);
            watchers.push(watcher);
          }
        })(),
      );
    }
    await Promise.all(tasks);
  } catch (error) {
    dispose();
    throw error;
  }

  for (const projectName in options.projects) {
    if (!(await exists(join(cwd(), "projects", projectName, ".milkio", "index.ts")))) await Bun.write(join(cwd(), "projects", projectName, ".milkio", "index.ts"), indexTs);
  }

  return dispose;
}

async function initializeProject(mode: string, root: string, appRoot: string, validDirs: string[], options: CookbookOptions, project: CookbookWatcherExtensionProject) {
  if (!(await exists(join(root, ".milkio", ".version"))) || (await readFile(join(root, ".milkio", ".version"), "utf-8")) !== `v${__VERSION__}.${options.hash}`) {
    await rm(join(root, ".milkio"), { recursive: true, force: true });
    try {
      await mkdir(join(root, ".milkio"));
    } catch (error) {}
    await Bun.write(join(root, ".milkio", ".version"), `v${__VERSION__}.${options.hash}`);
  }

  if (!allFiles.has(root)) {
    allFiles.set(root, new Map());
  }
  const projectFiles = allFiles.get(root)!;

  const globPattern = `{${validDirs.join(",")}}/**/*.ts`;
  const glob = new Glob(globPattern);
  const filesAsyncGenerator = glob.scan({ cwd: appRoot, onlyFiles: true });

  const extensionChangeFiles: Array<Array<CookbookWatcherFile>> = [];
  for (let i = 0; i < imports.length; i++) extensionChangeFiles.push([]);

  for await (const filePathRaw of filesAsyncGenerator) {
    if (filePathRaw.endsWith(".test.ts") || filePathRaw.endsWith(".spec.ts") || filePathRaw.includes(" copy")) continue;
    const filePath = filePathRaw.replaceAll("\\", "/");
    const fileName = filePath.split("/").pop()!;
    if (fileName.startsWith(".")) continue;
    if (fileName.startsWith("_")) continue;
    const fileData = processFile(filePath, appRoot, fileName);
    fileData.dependencyChanged = false;
    if (!projectFiles.has(filePath)) projectFiles.set(filePath, fileData);
    for (let i = 0; i < imports.length; i++) {
      if (imports[i].filter(fileData)) {
        extensionChangeFiles[i].push(fileData);
      }
    }

    await parseAndCacheDependencies(resolve(appRoot, filePath), appRoot);
  }

  const asyncTasks = [];
  for (let i = 0; i < imports.length; i++) {
    if (imports[i].async) {
      asyncTasks.push(imports[i]?.setup?.(root, mode, options, project, filterChangeFiles(extensionChangeFiles[i]), filterAllFiles(root, imports[i])));
    } else {
      try {
        await imports[i]?.setup?.(root, mode, options, project, filterChangeFiles(extensionChangeFiles[i]), filterAllFiles(root, imports[i]));
      } catch (error) {
        consola.error(error);
      }
    }
  }
  if (asyncTasks.length > 0) {
    try {
      await Promise.all(asyncTasks);
    } catch (error) {
      consola.error(error);
    }
  }

  await generateDeclares(root, mode, options, project, extensionChangeFiles);
}

async function generateDeclares(root: string, mode: string, options: CookbookOptions, project: CookbookWatcherExtensionProject, extensionChangeFiles: Array<Array<CookbookWatcherFile>>) {
  let header = "// declares";
  header += `\nimport type { generated } from "./index.ts";`;

  let content = `\ndeclare module "milkio" {`;
  let types = "";

  for (let i = 0; i < imports.length; i++) {
    if (!("declares" in imports[i])) continue;
    const files = filterAllFiles(root, imports[i]);
    if (!files) continue;

    const [rtnHeader, rtnTypes, rtnContent] = await (imports[i] as any).declares(root, mode, options, project, extensionChangeFiles[i], files);

    header += rtnHeader;
    types += rtnTypes;
    content += rtnContent;
  }

  content += "\n  interface $types {";
  content += "\n    generated: typeof generated";
  content += types;
  content += "\n  }";

  await Bun.write(join(root, ".milkio", "declares.d.ts"), `${header}\n${content}\n}`);
}

function setupWatcher(mode: string, root: string, appRoot: string, validDirs: string[], options: CookbookOptions, project: CookbookWatcherExtensionProject) {
  const extensionChangeFiles: Array<CookbookWatcherFile[]> = Array.from({ length: imports.length }, () => []);

  let isProcessing = false;
  let debounceTimer: any = null;
  const currentBatchChanges = new Map<string, boolean>();

  if (!allFiles.has(root)) {
    allFiles.set(root, new Map());
  }
  const projectFiles = allFiles.get(root)!;

  const processBatch = async () => {
    isProcessing = true;
    consola.info(chalk.gray(`[${getRate()}] ✨ type-safety applying..`));
    try {
      const batch = new Map(currentBatchChanges);
      currentBatchChanges.clear();

      for (const [filePath, isDependency] of batch) {
        const fileName = filePath.split("/").pop()!;
        const fileData = processFile(filePath, appRoot, fileName);
        fileData.dependencyChanged = isDependency;
        if (!projectFiles.has(filePath)) projectFiles.set(filePath, fileData);
        for (let i = 0; i < imports.length; i++) {
          if (imports[i].filter(fileData)) {
            extensionChangeFiles[i].push(fileData);
          }
        }
      }

      const asyncTasks = [];
      for (let i = 0; i < imports.length; i++) {
        if (extensionChangeFiles[i].length > 0) {
          if (imports[i].async) {
            asyncTasks.push(
              (async () => {
                try {
                  await imports[i]?.setup?.(root, mode, options, project, filterChangeFiles(extensionChangeFiles[i]), filterAllFiles(root, imports[i]));
                } catch (error) {
                  // biome-ignore lint/complexity/noUselessCatch: <explanation>
                  throw error;
                } finally {
                  extensionChangeFiles[i] = [];
                }
              })(),
            );
          } else {
            try {
              await imports[i]?.setup?.(root, mode, options, project, filterChangeFiles(extensionChangeFiles[i]), filterAllFiles(root, imports[i]));
            } catch (error) {
              consola.error(error);
            }
            extensionChangeFiles[i] = [];
          }
        }
      }
      if (asyncTasks.length > 0) {
        try {
          await Promise.all(asyncTasks);
        } catch (error) {
          consola.error(error);
        }
      }

      await generateDeclares(root, mode, options, project, extensionChangeFiles);
    } finally {
      isProcessing = false;
      if (currentBatchChanges.size > 0) {
        setTimeout(processBatch, 0);
      }
    }
  };

  const watcher = watch(appRoot, { persistent: true, recursive: true }, async (event, filename) => {
    if (!filename) return;

    const filePath = filename.replaceAll("\\", "/");

    const inValidDir = validDirs.some((dir) => filePath.startsWith(`${dir}/`));
    if (!inValidDir) return;
    if (!filePath.endsWith(".ts")) return;
    if (filePath.endsWith(".test.ts") || filePath.endsWith(".spec.ts")) return;

    const fileName = filePath.split("/").pop()!;
    if (fileName.startsWith(".")) return;
    if (fileName.startsWith("_")) return;

    const absolutePath = resolve(appRoot, filePath);

    currentBatchChanges.set(filePath, false);

    try {
      await parseAndCacheDependencies(absolutePath, appRoot);

      const affectedFiles = findAffectedFiles(absolutePath);
      for (const affectedFile of affectedFiles) {
        const relativePath = relative(appRoot, affectedFile).replaceAll("\\", "/");
        if (!currentBatchChanges.has(relativePath)) {
          currentBatchChanges.set(relativePath, true);
        }
      }
    } catch (error) {
      consola.error(`Failed to process file: ${filePath}`);
    }

    if (isProcessing) {
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(processBatch, 768);
  });

  return watcher;
}

function processFile(filePath: string, appRoot: string, fileName: string): CookbookWatcherFile {
  const importName = generateImportName(filePath);
  const type = getFileType(filePath);

  const parts = filePath.split("/");
  for (let i = 0; i < parts.length; i++) {
    const segment = parts[i];
    const isFileSegment = i === parts.length - 1;

    if (!segment) {
      consola.error(`Invalid path: '${segment}' (${join(appRoot, filePath)}). Path segments cannot be empty.`);
      exit(1);
    }

    if (!isFileSegment) {
      if (!/^[a-z0-9-]+$/.test(segment)) {
        consola.error(`Invalid folder: '${segment}' (${join(appRoot, filePath)}). Only lowercase letters, digits, and hyphens are allowed.`);
        exit(1);
      }
    } else {
      const mainPart = segment.slice(0, -3);

      const dotCount = segment.split(".").length - 1;
      if (dotCount < 1 || dotCount > 2) {
        consola.error(`Invalid file: '${segment}' (${join(appRoot, filePath)}). Must contain 1-2 dots (including extension).`);
        exit(1);
      }

      if (!/^[a-z0-9-\.]+$/.test(mainPart)) {
        consola.error(`Invalid file: '${segment}' (${join(appRoot, filePath)}). Only lowercase letters, digits, hyphens and dots are allowed.`);
        exit(1);
      }
    }
  }

  return {
    parts,
    projectFsPath: appRoot,
    path: filePath,
    fileName,
    importName,
    type,
    dependencyChanged: false,
  };
}

async function parseAndCacheDependencies(filePath: string, appRoot: string): Promise<void> {
  const oldDependencies = dependencyCache.get(filePath) || new Set<string>();
  const newDependencies = await extractImports(filePath, appRoot);

  dependencyCache.set(filePath, newDependencies);

  for (const dep of oldDependencies) {
    if (reverseDependencyGraph.has(dep)) {
      const dependents = reverseDependencyGraph.get(dep)!;
      dependents.delete(filePath);
      if (dependents.size === 0) {
        reverseDependencyGraph.delete(dep);
      }
    }
  }

  for (const dep of newDependencies) {
    if (!reverseDependencyGraph.has(dep)) {
      reverseDependencyGraph.set(dep, new Set());
    }
    reverseDependencyGraph.get(dep)!.add(filePath);
  }
}

async function extractImports(filePath: string, appRoot: string): Promise<Set<string>> {
  const imports = new Set<string>();

  try {
    const fileContent = await readFile(filePath, "utf-8");
    const rl = createInterface({
      input: Readable.from(fileContent),
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    for await (const line of rl) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("//")) continue;
      if (trimmed.startsWith("/*") || !trimmed.startsWith("import")) break;

      const match = line.match(/from\s+["']([^"']+)["']/);
      if (match) {
        const importPath = match[1];
        const resolved = resolveImportPath(importPath, filePath, appRoot);
        if (resolved) {
          imports.add(resolved);
        }
      }
    }
  } catch (error) {
    consola.error(`Failed to parse file: ${filePath}`);
  }

  return imports;
}

function resolveImportPath(importPath: string, importerPath: string, appRoot: string): string | null {
  if (importPath.startsWith(".") || importPath.startsWith("/") || importPath.startsWith("~/") || importPath.startsWith("@/")) {
    let resolved: string;
    if (importPath.startsWith(".")) {
      resolved = resolve(dirname(importerPath), importPath);
    } else {
      const normalized = importPath.replace(/^(~|@)\//, "/");
      resolved = resolve(appRoot, "../", normalized.slice(1));
    }

    if (!resolved.endsWith(".ts")) {
      resolved += ".ts";
    }

    if (!resolved.includes("node_modules") && !resolved.includes("/.") && resolved.startsWith(dirname(appRoot))) {
      return resolved;
    }
  }

  return null;
}

function findAffectedFiles(changedFile: string): Set<string> {
  const affected = new Set<string>();
  const visited = new Set<string>();
  const queue = [changedFile];

  visited.add(changedFile);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reverseDependencyGraph.has(current)) {
      for (const dependent of reverseDependencyGraph.get(current)!) {
        if (!visited.has(dependent)) {
          visited.add(dependent);
          affected.add(dependent);
          queue.push(dependent);
        }
      }
    }
  }

  return affected;
}

function generateImportName(filePath: string): string {
  return filePath
    .slice(0, filePath.length - 3)
    .replaceAll("/", "$")
    .replaceAll("-", "_")
    .replaceAll(".", "T");
}

function getFileType(path: string): string | null {
  let dot1 = -1;
  let dot2 = -1;

  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i] === ".") {
      if (dot1 === -1) {
        dot1 = i;
      } else {
        dot2 = i;
        break;
      }
    }
  }

  if (dot1 === -1 || dot2 === -1 || path.slice(dot1) !== ".ts") {
    return null;
  }

  return path.slice(dot2 + 1, dot1);
}

function filterChangeFiles(changeFiles: Array<CookbookWatcherFile>): Array<CookbookWatcherFile> {
  const map = new Map<string, CookbookWatcherFile>();
  for (const item of changeFiles) {
    if (!map.has(item.path)) {
      map.set(item.path, item);
    }
  }
  return Array.from(map.values());
}

function filterAllFiles(root: string, extension: ReturnType<typeof defineWatcherExtension>) {
  const projectFiles = allFiles.get(root);
  if (!projectFiles) return [];
  const result = [...projectFiles.values()].filter((file) => extension.filter(file));
  return result;
}
