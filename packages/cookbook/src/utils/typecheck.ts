import { spawn } from "node:child_process";
import { join } from "node:path";
import { cwd, exit, platform } from "node:process";
import { exists, rm } from "node:fs/promises";
import consola from "consola";
import type { CookbookOptions } from "./cookbook-dto-types";
import { getRuntime } from "./get-runtime";

type TypecheckResult = {
  projectName: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

type CheckResult = TypecheckResult & {
  kind: "typecheck" | "lint";
};

/**
 * Concurrently runs type/lint checks for every project listed in cookbook.toml.
 *
 * Per-project dispatch:
 *   - `milkio` projects always run `ttsc check` (Typia TypeScript Compiler,
 *     equivalent to `tsc --noEmit` but with native typia transformer support).
 *   - `custom` projects run their own `lint` script from package.json via the
 *     configured package manager (`${packageManager} run lint`). If a custom
 *     project does not declare a `lint` script, it falls back to `ttsc check`
 *     (with a warning) so it is still covered.
 *
 * If any project fails, prints the failures and exits with code 1 so the
 * caller cannot continue.
 *
 * Why `ttsc` instead of stock `tsc`:
 *   - `ttsc` is tsgo (TypeScript-Go) under the hood, same engine as `tsc`
 *     in TS 7.x, so type-checking semantics are equivalent.
 *   - Additionally, `ttsc` loads the typia transformer plugin, which can
 *     report typia-specific diagnostics (e.g. "type T is not validatable")
 *     that stock `tsc` cannot surface. This gives an earlier, richer
 *     signal when route schemas or business code misuse typia APIs.
 *
 * A temporary `tsconfig.typecheck.json` is created for each ttsc-checked
 * project that extends the project's own `tsconfig.json` but overrides
 * `composite`, `declaration`, and `emitDeclarationOnly` to `false`. This is
 * necessary because some embed projects use `composite: true` (which implies
 * `declaration: true`) so they can be referenced by other composite projects.
 * When `declaration: true` is active, the compiler validates that every
 * exported inferred type can be named in a declaration file, triggering
 * TS2883 for typia phantom tag types (Pattern, Minimum, Maximum, MaxLength,
 * Type) that are carried by drizzle table definitions and stargate/astra
 * inference. Since we are running `check` (not generating declarations),
 * the declaration portability check is not relevant here — it is handled
 * separately by the route generation pipeline.
 *
 * The typia transformer plugin is explicitly registered in
 * `compilerOptions.plugins` (rather than relying on ttsc's auto-discovery
 * from direct dependencies' `ttsc.plugin` field) because in this monorepo
 * `typia` is a dependency of the workspace root, not a direct dependency
 * of each individual project. ttsc's auto-discovery only walks the nearest
 * `package.json`, so it would never see typia's `ttsc.plugin` config. This
 * mirrors the approach used in `route-typia.ts` for the typia generation
 * phase. The plugin binary is built on-demand by ttsc (cached after first
 * use); the route-typia phase runs before this check, so the cache is
 * typically already warm.
 *
 * Runtime resolution: each project's `runtime` field in cookbook.toml
 * (e.g. `runtime = "node"`) determines which JavaScript runtime is used
 * to launch ttsc. This is necessary because `co.exe` is a Bun-compiled
 * binary — `process.execPath` points to `co.exe` itself, not to a real
 * JS runtime, so spawning `process.execPath ttsc.js ...` would make
 * co.exe treat `ttsc.js` as a command name. We honor the per-project
 * `runtime` config (falling back to `getRuntime`'s default) and resolve
 * it to an absolute executable path via `Bun.which`. Users with only
 * Node.js or only Bun installed are both supported.
 */
function resolveRuntimeExecutable(preferredRuntime: "node" | "bun"): string {
  // Under Bun (including compiled binaries like co.exe), `Bun.which` finds
  // an executable on PATH. Under plain Node.js, fall back to execPath.
  if (typeof Bun !== "undefined") {
    const resolved = Bun.which(preferredRuntime);
    if (resolved) return resolved;
    // Preferred runtime not on PATH — try the other one as a fallback.
    const fallback = preferredRuntime === "node" ? Bun.which("bun") : Bun.which("node");
    if (fallback) return fallback;
  }
  return process.execPath;
}

export async function typecheckProjects(options: CookbookOptions): Promise<void> {
  const workspacePath = cwd();
  const ttscPath = join(workspacePath, "node_modules", "ttsc", "lib", "launcher", "ttsc.js");
  const allProjects = options.projects ?? {};

  // Categorize projects based on type and lint script availability.
  // - milkio projects always run ttsc check.
  // - custom projects run their own `lint` script from package.json via the
  //   configured package manager. If a custom project does not declare a
  //   `lint` script, it falls back to ttsc check (with a warning) so it is
  //   still covered.
  const milkioProjectNames: string[] = [];
  const customLintProjectNames: string[] = [];
  const customFallbackProjectNames: string[] = [];

  for (const [name, project] of Object.entries(allProjects)) {
    if (project.type === "milkio") {
      milkioProjectNames.push(name);
    } else if (project.type === "custom") {
      const projectPath = join(workspacePath, "projects", name);
      const packageJsonPath = join(projectPath, "package.json");
      let hasLintScript = false;
      try {
        if (await exists(packageJsonPath)) {
          const packageJson = JSON.parse(await Bun.file(packageJsonPath).text());
          if (packageJson?.scripts?.lint) {
            hasLintScript = true;
          }
        }
      } catch {}

      if (hasLintScript) {
        customLintProjectNames.push(name);
      } else {
        consola.warn(
          `Project "${name}" does not have a "lint" script configured in its package.json scripts. Defaulting to ttsc check.`,
        );
        customFallbackProjectNames.push(name);
      }
    }
  }

  const ttscProjectNames = [...milkioProjectNames, ...customFallbackProjectNames];

  if (ttscProjectNames.length === 0 && customLintProjectNames.length === 0) return;

  const tempTsconfigName = "tsconfig.typecheck.json";
  const results: CheckResult[] = [];

  // Phase 1: ttsc check for milkio projects + custom projects without lint.
  if (ttscProjectNames.length > 0) {
    if (!(await exists(ttscPath))) {
      consola.warn(`ttsc compiler not found at "${ttscPath}", skipping type check.`);
    } else {
      consola.info(`Type checking ${ttscProjectNames.length} project(s) with ttsc check concurrently..`);

      const ttscResults = await Promise.all(
        ttscProjectNames.map(async (projectName): Promise<CheckResult> => {
          const projectPath = join(workspacePath, "projects", projectName);
          if (!(await exists(projectPath))) {
            return {
              projectName,
              exitCode: 1,
              stdout: "",
              stderr: `Project directory not found: ${projectPath}`,
              kind: "typecheck",
            };
          }

          // Resolve the JS runtime for this project from its cookbook.toml
          // `runtime` field (e.g. `runtime = "node"`). Falls back to the
          // default chosen by `getRuntime` (which checks availability).
          const project = allProjects[projectName];
          const preferredRuntime = await getRuntime((project.runtime === "bun" ? "bun" : "node") as "node" | "bun");
          const runtimePath = resolveRuntimeExecutable(preferredRuntime);

          const tempTsconfigPath = join(projectPath, tempTsconfigName);
          const tempTsconfig = {
            extends: "./tsconfig.json",
            compilerOptions: {
              composite: false,
              declaration: false,
              emitDeclarationOnly: false,
              // Explicitly register the typia transformer plugin. See the
              // function-level comment for why auto-discovery does not work here.
              plugins: [{ transform: "typia/lib/transform" }],
            },
          };
          await Bun.write(tempTsconfigPath, JSON.stringify(tempTsconfig, null, 2));

          try {
            return await new Promise<CheckResult>((resolve) => {
              const child = spawn(runtimePath, [ttscPath, "check", "-p", tempTsconfigName], {
                cwd: projectPath,
                stdio: "pipe",
                shell: false,
                windowsHide: true,
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
                resolve({ projectName, exitCode: 1, stdout, stderr: stderr + `\n${err.message}`, kind: "typecheck" });
              });

              child.on("close", (code: number | null) => {
                resolve({ projectName, exitCode: code ?? 1, stdout, stderr, kind: "typecheck" });
              });
            });
          } finally {
            await rm(tempTsconfigPath, { force: true }).catch(() => {});
          }
        }),
      );
      results.push(...ttscResults);
    }
  }

  // Phase 2: lint for custom projects with a `lint` script in package.json.
  // Uses the workspace's configured package manager (`options.general.packageManager`)
  // to invoke the script, e.g. `npm run lint`, `pnpm run lint`, `bun run lint`.
  if (customLintProjectNames.length > 0) {
    consola.info(`Linting ${customLintProjectNames.length} custom project(s) with their lint script..`);

    const shell = platform === "win32" ? "powershell.exe" : "bash";
    const shellFlag = platform === "win32" ? "-Command" : "-c";

    const lintResults = await Promise.all(
      customLintProjectNames.map(async (projectName): Promise<CheckResult> => {
        const projectPath = join(workspacePath, "projects", projectName);
        if (!(await exists(projectPath))) {
          return {
            projectName,
            exitCode: 1,
            stdout: "",
            stderr: `Project directory not found: ${projectPath}`,
            kind: "lint",
          };
        }

        const script = `${options.general.packageManager} run lint`;

        return await new Promise<CheckResult>((resolve) => {
          const child = spawn(shell, [shellFlag, script], {
            cwd: projectPath,
            stdio: "pipe",
            shell: false,
            windowsHide: true,
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
            resolve({ projectName, exitCode: 1, stdout, stderr: stderr + `\n${err.message}`, kind: "lint" });
          });

          child.on("close", (code: number | null) => {
            resolve({ projectName, exitCode: code ?? 1, stdout, stderr, kind: "lint" });
          });
        });
      }),
    );
    results.push(...lintResults);
  }

  const failures = results.filter((r) => r.exitCode !== 0);

  if (failures.length > 0) {
    console.log("");
    for (const failure of failures) {
      const label = failure.kind === "lint" ? "Lint" : "Type check";
      consola.error(`${label} failed for project "${failure.projectName}" (exit code ${failure.exitCode}):`);
      if (failure.stdout.trim()) console.log(failure.stdout.trim());
      if (failure.stderr.trim()) console.log(failure.stderr.trim());
      console.log("");
    }
    consola.error(
      `Encountered errors in ${failures.length} of ${results.length} project(s). Please fix the errors before running.`,
    );
    exit(1);
  }

  if (results.length > 0) {
    consola.success(`All checks passed for ${results.length} project(s).`);
  }
}
