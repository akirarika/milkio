import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";

// ---- step 1: copy test project to test-bun / test-deno ----

const PROJECT_BASE = "./projects";
const SOURCE_PROJECT = "test";
const TARGET_PROJECTS = ["test-bun", "test-deno"];
const DIRS_TO_COPY = ["app"];

const sourcePath = path.join(PROJECT_BASE, SOURCE_PROJECT);
if (!existsSync(sourcePath)) {
  throw new Error(`Not found: ${sourcePath}`);
}

await Promise.all(
  TARGET_PROJECTS.map(async (target) => {
    const targetPath = path.join(PROJECT_BASE, target);

    await fs.mkdir(targetPath, { recursive: true });

    await Promise.all(
      DIRS_TO_COPY.map(async (dir) => {
        const sourceDir = path.join(sourcePath, dir);
        const targetDir = path.join(targetPath, dir);

        if (existsSync(targetDir)) {
          await fs.rm(targetDir, { recursive: true, force: true });
        }

        if (existsSync(sourceDir)) {
          console.log(`copy: ${sourceDir} -> ${targetDir}`);
          await fs.cp(sourceDir, targetDir, { recursive: true, force: true });
        }
      }),
    );
  }),
);

// ---- step 2: replace workspace symlinks with real copies (Windows workaround) ----

async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

const WS_ROOTS = ["packages", "projects"];

for (const root of WS_ROOTS) {
  if (!existsSync(root)) continue;
  const dirs = await fs.readdir(root, { withFileTypes: true });
  for (const dirent of dirs) {
    if (!dirent.isDirectory()) continue;

    const pkgDir = path.join(root, dirent.name);
    const pkgJsonPath = path.join(pkgDir, "package.json");
    if (!existsSync(pkgJsonPath)) continue;

    let pkgName: string;
    try {
      pkgName = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8")).name;
      if (!pkgName) continue;
    } catch {
      continue;
    }

    const nodeModulesPath = path.join("node_modules", pkgName);

    // existsSync returns false for broken Windows symlinks
    if (!existsSync(nodeModulesPath)) {
      console.log(`fix symlink: ${pkgDir} -> ${nodeModulesPath}`);
      try { await fs.rm(nodeModulesPath, { recursive: true, force: true }); } catch { /* ignore */ }
      await copyDir(pkgDir, nodeModulesPath);
    }
  }
}

console.log("prepare done.");
