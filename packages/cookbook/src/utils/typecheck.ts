import { spawn } from "node:child_process";
import { join } from "node:path";
import { cwd, exit } from "node:process";
import { exists, rm } from "node:fs/promises";
import consola from "consola";
import type { CookbookOptions } from "./cookbook-dto-types";

type TypecheckResult = {
  projectName: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

/**
 * Concurrently runs `ttsc check` (Typia TypeScript Compiler, equivalent to
 * `tsc --noEmit` but with native typia transformer support) for every
 * milkio-typed project listed in cookbook.toml. Custom (non-milkio, e.g.
 * Nuxt) projects are skipped because their own toolchains already handle
 * type checking and they may legitimately rely on framework-internal types
 * that are not portable. If any milkio project has type errors, prints the
 * errors and exits with code 1 so the caller cannot continue.
 *
 * Why `ttsc` instead of stock `tsc`:
 *   - `ttsc` is tsgo (TypeScript-Go) under the hood, same engine as `tsc`
 *     in TS 7.x, so type-checking semantics are equivalent.
 *   - Additionally, `ttsc` loads the typia transformer plugin, which can
 *     report typia-specific diagnostics (e.g. "type T is not validatable")
 *     that stock `tsc` cannot surface. This gives an earlier, richer
 *     signal when route schemas or business code misuse typia APIs.
 *
 * A temporary `tsconfig.typecheck.json` is created for each project that
 * extends the project's own `tsconfig.json` but overrides `composite`,
 * `declaration`, and `emitDeclarationOnly` to `false`. This is necessary
 * because some embed projects use `composite: true` (which implies
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
 */
export async function typecheckProjects(options: CookbookOptions): Promise<void> {
  const workspacePath = cwd();
  const ttscPath = join(workspacePath, "node_modules", "ttsc", "lib", "launcher", "ttsc.js");

  if (!(await exists(ttscPath))) {
    consola.warn(`ttsc compiler not found at "${ttscPath}", skipping type check.`);
    return;
  }

  const allProjects = options.projects ?? {};
  const projectNames = Object.entries(allProjects)
    .filter(([, project]) => project.type === "milkio")
    .map(([name]) => name);
  if (projectNames.length === 0) return;

  consola.info(`Type checking ${projectNames.length} milkio project(s) with ttsc check concurrently..`);

  const tempTsconfigName = "tsconfig.typecheck.json";

  const results: TypecheckResult[] = await Promise.all(
    projectNames.map(async (projectName): Promise<TypecheckResult> => {
      const projectPath = join(workspacePath, "projects", projectName);
      if (!(await exists(projectPath))) {
        return { projectName, exitCode: 1, stdout: "", stderr: `Project directory not found: ${projectPath}` };
      }

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
        return await new Promise<TypecheckResult>((resolve) => {
          const child = spawn(process.execPath, [ttscPath, "check", "-p", tempTsconfigName], {
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
            resolve({ projectName, exitCode: 1, stdout, stderr: stderr + `\n${err.message}` });
          });

          child.on("close", (code: number | null) => {
            resolve({ projectName, exitCode: code ?? 1, stdout, stderr });
          });
        });
      } finally {
        await rm(tempTsconfigPath, { force: true }).catch(() => {});
      }
    }),
  );

  const failures = results.filter((r) => r.exitCode !== 0);

  if (failures.length > 0) {
    console.log("");
    for (const failure of failures) {
      consola.error(`Type check failed for project "${failure.projectName}" (exit code ${failure.exitCode}):`);
      if (failure.stdout.trim()) console.log(failure.stdout.trim());
      if (failure.stderr.trim()) console.log(failure.stderr.trim());
      console.log("");
    }
    consola.error(
      `Encountered type errors in ${failures.length} of ${projectNames.length} project(s). Please fix the type errors before running.`,
    );
    exit(1);
  }

  consola.success(`Type check passed for all ${projectNames.length} project(s).`);
}
