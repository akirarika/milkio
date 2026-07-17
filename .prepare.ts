import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The milkio source directory (where this script lives).
// Used to locate milkio's own packages when this script is invoked from
// a downstream workspace (e.g. kecream-projects) that depends on milkio.
const MILKIO_DIR = path.dirname(fileURLToPath(import.meta.url));

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

// Read the package name from a package.json file. Returns undefined if the
// file is missing or has no "name" field.
async function readPackageName(pkgJsonPath: string): Promise<string | undefined> {
  if (!existsSync(pkgJsonPath)) return undefined;
  try {
    const pkg = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));
    return pkg?.name || undefined;
  } catch {
    return undefined;
  }
}

// Read the "dependencies" (runtime) map from a package.json file.
async function readDependencies(pkgJsonPath: string): Promise<Record<string, string>> {
  if (!existsSync(pkgJsonPath)) return {};
  try {
    const pkg = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));
    return pkg?.dependencies ?? {};
  } catch {
    return {};
  }
}

// ---- step 1: copy test project to test-bun / test-deno ----
// This step is specific to the milkio workspace itself (it has a projects/test
// project that is mirrored to projects/test-bun and projects/test-deno so the
// same tests can run under both runtimes). When this script is run from a
// downstream workspace that does not have projects/test, skip this step.

const PROJECT_BASE = "./projects";
const SOURCE_PROJECT = "test";
const TARGET_PROJECTS = ["test-bun", "test-deno"];
const DIRS_TO_COPY = ["app"];

const sourcePath = path.join(PROJECT_BASE, SOURCE_PROJECT);
if (existsSync(sourcePath)) {
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
} else {
  console.log(`skip step 1: ${sourcePath} not found (not in milkio workspace)`);
}

// ---- step 2: replace workspace symlinks with real copies (Windows workaround) ----
// On Windows, workspace symlinks created by package managers can become broken.
// existsSync returns false for broken symlinks, so we detect them and replace
// them with real copies of the package source. This only handles packages that
// belong to the CURRENT workspace (packages/* and projects/* relative to cwd).

const WS_ROOTS = ["packages", "projects"];

for (const root of WS_ROOTS) {
  if (!existsSync(root)) continue;
  const dirs = await fs.readdir(root, { withFileTypes: true });
  for (const dirent of dirs) {
    if (!dirent.isDirectory()) continue;

    const pkgDir = path.join(root, dirent.name);
    const pkgJsonPath = path.join(pkgDir, "package.json");
    const pkgName = await readPackageName(pkgJsonPath);
    if (!pkgName) continue;

    const nodeModulesPath = path.join("node_modules", pkgName);

    // existsSync returns false for broken Windows symlinks
    if (!existsSync(nodeModulesPath)) {
      console.log(`fix symlink: ${pkgDir} -> ${nodeModulesPath}`);
      try { await fs.rm(nodeModulesPath, { recursive: true, force: true }); } catch { /* ignore */ }
      await copyDir(pkgDir, nodeModulesPath);
    }
  }
}

// ---- step 3: link milkio source packages into the current workspace ----
// When this script is invoked from a DOWNSTREAM workspace (e.g. kecream-projects)
// that depends on milkio, the installed published packages in node_modules may be
// stale or broken. To run tests against the local milkio source, copy milkio's own
// packages/* into the current workspace's node_modules, overwriting whatever is
// there. This is skipped when the current workspace IS the milkio workspace
// (step 2 already handles that case there).

// ---- step 3: link milkio source packages into the current workspace ----
// When this script is invoked from a DOWNSTREAM workspace (e.g. kecream-projects)
// that depends on milkio, the installed published packages in node_modules may be
// stale or broken. To run tests against the local milkio source, copy milkio's own
// packages/* into the current workspace's node_modules, overwriting whatever is
// there. This is skipped when the current workspace IS the milkio workspace
// (step 2 already handles that case there).

const currentDir = path.resolve(".");
const isDownstreamWorkspace = currentDir !== path.resolve(MILKIO_DIR);

if (isDownstreamWorkspace) {
  const milkioPackagesDir = path.join(MILKIO_DIR, "packages");
  if (existsSync(milkioPackagesDir)) {
    const dirs = await fs.readdir(milkioPackagesDir, { withFileTypes: true });
    for (const dirent of dirs) {
      if (!dirent.isDirectory()) continue;

      const pkgDir = path.join(milkioPackagesDir, dirent.name);
      const pkgJsonPath = path.join(pkgDir, "package.json");
      const pkgName = await readPackageName(pkgJsonPath);
      if (!pkgName) continue;

      const nodeModulesPath = path.join("node_modules", pkgName);
      console.log(`link milkio source: ${pkgDir} -> ${nodeModulesPath}`);
      try { await fs.rm(nodeModulesPath, { recursive: true, force: true }); } catch { /* ignore */ }
      await copyDir(pkgDir, nodeModulesPath);
    }
  }
}

// ---- step 4: link missing dependencies from milkio's node_modules ----
// The published milkio packages bundle their dependencies (their package.json has
// "dependencies": {}), so downstream workspaces like kecream-projects never had
// those transitive dependencies installed. The local source packages, however,
// declare real dependencies (js-toml, @iarna/toml, date-fns, chalk, etc.) that
// must be resolvable at type-check / typia-transpile time.
//
// When running in a downstream workspace, collect every runtime dependency
// declared by the milkio source packages and, for any that are not already
// present in the current workspace's node_modules, copy them from milkio's
// node_modules (recursively, so transitive deps are also satisfied). Existing
// packages in the downstream workspace are never overwritten — only gaps are
// filled.

if (isDownstreamWorkspace) {
  const milkioNodeModules = path.join(MILKIO_DIR, "node_modules");
  const targetNodeModules = path.join("node_modules");

  if (existsSync(milkioNodeModules)) {
    // Gather every runtime dependency declared by milkio's own packages.
    const requiredDeps = new Set<string>();
    const milkioPackagesDir = path.join(MILKIO_DIR, "packages");
    if (existsSync(milkioPackagesDir)) {
      const dirs = await fs.readdir(milkioPackagesDir, { withFileTypes: true });
      for (const dirent of dirs) {
        if (!dirent.isDirectory()) continue;
        const pkgJsonPath = path.join(milkioPackagesDir, dirent.name, "package.json");
        const deps = await readDependencies(pkgJsonPath);
        for (const dep of Object.keys(deps)) requiredDeps.add(dep);
      }
    }

    // Recursively copy a dependency (and its transitive deps) from milkio's
    // node_modules into the target workspace if it is not already present.
    const visited = new Set<string>();
    async function linkDependency(depName: string) {
      if (visited.has(depName)) return;
      visited.add(depName);

      const targetPath = path.join(targetNodeModules, depName);
      if (existsSync(targetPath)) return; // already satisfied in downstream

      const sourcePath = path.join(milkioNodeModules, depName);
      if (!existsSync(sourcePath)) {
        console.log(`warning: dependency not in milkio node_modules: ${depName}`);
        return;
      }

      console.log(`link dependency: ${depName}`);
      await copyDir(sourcePath, targetPath);

      // Recurse into the copied package's own runtime dependencies so that
      // transitive deps are also satisfied.
      const depPkgJson = path.join(sourcePath, "package.json");
      const transitive = await readDependencies(depPkgJson);
      for (const t of Object.keys(transitive)) {
        await linkDependency(t);
      }
    }

    for (const dep of requiredDeps) {
      await linkDependency(dep);
    }
  }
}

// ---- step 5: build vite-plugin-milkio as JavaScript ----
// vite-plugin-milkio is imported by vite.config.ts, which is loaded by Node.js
// (not Vite's own loader) when starting the dev server. Node.js supports type
// stripping for .ts files in user code but NOT for files under node_modules.
// Since step 3 copies the .ts source into node_modules, we must also build a
// .js bundle so Node.js can load the plugin without ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING.

if (isDownstreamWorkspace) {
  const vitePluginMilkioDir = path.join("node_modules", "@milkio", "vite-plugin-milkio");
  if (existsSync(vitePluginMilkioDir)) {
    const entrypoint = path.join(vitePluginMilkioDir, "index.ts");
    if (existsSync(entrypoint)) {
      const buildResult = await Bun.build({
        entrypoints: [entrypoint],
        outdir: vitePluginMilkioDir,
        target: "node",
        format: "esm",
        external: ["vite", "@iarna/toml", "fs-extra", "glob"],
      });
      if (!buildResult.success) {
        for (const log of buildResult.logs) console.log(log);
        throw new Error("Failed to build vite-plugin-milkio");
      }
      // Update package.json exports to point to .js instead of .ts
      const pkgJsonPath = path.join(vitePluginMilkioDir, "package.json");
      const pkg = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));
      pkg.exports = "./index.js";
      await fs.writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2), "utf-8");
      console.log("built vite-plugin-milkio as JavaScript");
    }
  }
}

console.log("prepare done.");
