import { spawn } from "node:child_process";
import { join } from "node:path";
import { cwd, exit } from "node:process";
import { exists } from "node:fs/promises";
import consola from "consola";
import type { CookbookOptions } from "./cookbook-dto-types";

type TypecheckResult = {
  projectName: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

/**
 * Concurrently runs `tsc --noEmit` for every project listed in cookbook.toml,
 * regardless of project type. If any project has type errors, prints the errors
 * and exits with code 1 so the caller cannot continue.
 */
export async function typecheckProjects(options: CookbookOptions): Promise<void> {
  const workspacePath = cwd();
  const tscPath = join(workspacePath, "node_modules", "typescript", "bin", "tsc");

  if (!(await exists(tscPath))) {
    consola.warn(`TypeScript compiler not found at "${tscPath}", skipping type check.`);
    return;
  }

  const projectNames = Object.keys(options.projects ?? {});
  if (projectNames.length === 0) return;

  consola.info(`Type checking ${projectNames.length} project(s) with tsc --noEmit concurrently..`);

  const results: TypecheckResult[] = await Promise.all(
    projectNames.map(async (projectName): Promise<TypecheckResult> => {
      const projectPath = join(workspacePath, "projects", projectName);
      if (!(await exists(projectPath))) {
        return { projectName, exitCode: 1, stdout: "", stderr: `Project directory not found: ${projectPath}` };
      }
      return await new Promise<TypecheckResult>((resolve) => {
        const child = spawn(process.execPath, [tscPath, "--noEmit"], {
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
