import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

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
// Both step 2 (milkio workspace) and step 3 (downstream workspaces) copy the
// .ts source into node_modules, so in either case we must also build a .js
// bundle so Node.js can load the plugin without
// ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING. This is required for the
// node-runtime "test" project in the milkio workspace as well.

{
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

// ---- step 6: ttsc check milkio projects ----
// Run `ttsc check` on every milkio-typed project declared in cookbook.toml to
// surface type errors early — before `co test` / `co dev` / `co build` spawns
// any watcher or worker. This mirrors the logic in
// `packages/cookbook/src/utils/typecheck.ts` but runs as part of the prepare
// phase so failures short-circuit the whole `co` invocation cleanly.
//
// Only runs when this script is invoked from inside the milkio workspace
// itself. Downstream workspaces already get type checking via `co test`'s
// typecheckProjects phase, so we skip there to avoid double work.
//
// A temporary `tsconfig.typecheck.json` is created per project that extends
// the project's own `tsconfig.json` but overrides `composite`, `declaration`,
// and `emitDeclarationOnly` to `false` (so composite projects don't trigger
// TS2883 for typia phantom tag types) and explicitly registers the typia
// transformer plugin (because `typia` is a dependency of the workspace root,
// not of each individual project, so ttsc's auto-discovery can't find it).

if (!isDownstreamWorkspace) {
  const cookbookTomlPath = path.join(MILKIO_DIR, "cookbook.toml");
  if (existsSync(cookbookTomlPath)) {
    const cookbookTomlText = await fs.readFile(cookbookTomlPath, "utf-8");
    const cookbookToml = (Bun as any).TOML.parse(cookbookTomlText) as {
      projects?: Record<string, { type?: string; runtime?: string }>;
    };
    const projects = cookbookToml.projects ?? {};

    const ttscPath = path.join(MILKIO_DIR, "node_modules", "ttsc", "lib", "launcher", "ttsc.js");
    if (!existsSync(ttscPath)) {
      console.log("skip step 6: ttsc not found");
    } else {
      const milkioProjectNames = Object.entries(projects)
        .filter(([, p]) => p.type === "milkio")
        .map(([name]) => name);

      if (milkioProjectNames.length > 0) {
        console.log(`step 6: ttsc check ${milkioProjectNames.length} milkio project(s)..`);

        const tempTsconfigName = "tsconfig.typecheck.json";
        const results: Array<{ projectName: string; exitCode: number; stdout: string; stderr: string }> = [];

        await Promise.all(
          milkioProjectNames.map(async (projectName) => {
            const projectPath = path.join(MILKIO_DIR, "projects", projectName);
            if (!existsSync(projectPath)) {
              results.push({
                projectName,
                exitCode: 1,
                stdout: "",
                stderr: `Project directory not found: ${projectPath}`,
              });
              return;
            }

            const tempTsconfigPath = path.join(projectPath, tempTsconfigName);
            const tempTsconfig = {
              extends: "./tsconfig.json",
              compilerOptions: {
                composite: false,
                declaration: false,
                emitDeclarationOnly: false,
                plugins: [{ transform: "typia/lib/transform" }],
              },
            };
            await fs.writeFile(tempTsconfigPath, JSON.stringify(tempTsconfig, null, 2));

            try {
              const preferredRuntime = projects[projectName].runtime === "bun" ? "bun" : "node";
              const runtimePath =
                typeof Bun !== "undefined" && (Bun as any).which
                  ? (Bun as any).which(preferredRuntime) ??
                    (Bun as any).which(preferredRuntime === "bun" ? "node" : "bun") ??
                    process.execPath
                  : process.execPath;

              const result = await new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
                const child = spawn(runtimePath, [ttscPath, "check", "-p", tempTsconfigName], {
                  cwd: projectPath,
                  stdio: "pipe",
                  shell: false,
                });

                let stdout = "";
                let stderr = "";

                child.stdout.on("data", (data: Buffer) => {
                  stdout += data.toString();
                });
                child.stderr.on("data", (data: Buffer) => {
                  stderr += data.toString();
                });

                child.on("error", (err: Error) => {
                  resolve({ exitCode: 1, stdout, stderr: stderr + `\n${err.message}` });
                });

                child.on("close", (code: number | null) => {
                  resolve({ exitCode: code ?? 1, stdout, stderr });
                });
              });

              results.push({ projectName, ...result });
            } finally {
              await fs.rm(tempTsconfigPath, { force: true }).catch(() => {});
            }
          }),
        );

        const failures = results.filter((r) => r.exitCode !== 0);
        if (failures.length > 0) {
          for (const failure of failures) {
            console.error(`Type check failed for project "${failure.projectName}" (exit code ${failure.exitCode}):`);
            if (failure.stdout.trim()) console.log(failure.stdout.trim());
            if (failure.stderr.trim()) console.error(failure.stderr.trim());
            console.log("");
          }
          console.error(`Encountered errors in ${failures.length} of ${results.length} project(s).`);
          process.exit(1);
        }

        console.log(`All type checks passed for ${results.length} project(s).`);
      }
    }
  }
}

console.log("prepare done.");
