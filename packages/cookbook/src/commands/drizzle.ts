import { cwd, exit } from "node:process";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import { selectProject } from "../utils/select-project";
import { join } from "node:path";
import { exists, mkdir, readFile, writeFile } from "node:fs/promises";
import { execScript } from "../utils/exec-script";
import { select } from "../utils/select";
import { env, Glob } from "bun";
import { existsSync } from "fs-extra";
import consola from "consola";
import { progress } from "../progress";

export default await defineCookbookCommand(async (utils, userCommand?: string, projectUsed?: string, modeUsed?: string) => {
  const params = utils.getParams();
  const cookbookToml = await utils.getCookbookToml();
  const project = await selectProject(cookbookToml, {
    filter: async (project) => {
      return (await exists(join(cwd(), "projects", project.value, "drizzle"))) || (await exists(join(cwd(), "projects", project.value, "drizzle.config.ts")));
    },
    projectUsed,
  });
  if (!project) exit(0);
  const packageJson = await readFile(join(cwd(), "projects", project.value, "package.json"), "utf-8");
  const packageJsonParsed = JSON.parse(packageJson);
  if (packageJsonParsed?.scripts?.drizzle === undefined || packageJsonParsed.scripts.drizzle === "") {
    if (!packageJsonParsed) packageJsonParsed.scripts = {};
    packageJsonParsed.scripts.drizzle = "drizzle-kit";
    await writeFile(join(cwd(), "projects", project.value, "package.json"), JSON.stringify(packageJsonParsed, null, 2));
  }
  if (!params.commands.at(0) && !userCommand) {
    const command = `${cookbookToml.general.packageManager} run drizzle`;
    await execScript(command, {
      cwd: project.path,
      env: {
        ...env,
      },
    });
    exit(0);
  }

  if (!project.drizzle || project.drizzle.length === 0) {
    consola.error("Drizzle configuration not found, please add a mode in your cookbook.toml.");
    exit(1);
  }

  const mode = await select("Select the mode:", project.drizzle ?? [], "mode", modeUsed);
  if (!mode?.migrateMode) {
    consola.error("Drizzle configuration not found, please add a 'migrateMode = \"generate\"' in your cookbook.toml.");
    exit(1);
  }

  if (mode.migrateMode === "push" && (params.commands.at(0) === "generate" || params.commands.at(0) === "migrate")) {
    consola.error("The mode is configured with 'migrateMode = \"push\"', but you are trying to execute the generate or migrate command. To avoid accidental command execution, this command has been stopped.");
    exit(1);
  }

  if (mode.migrateMode === "generate" && (params.commands.at(0) === "push" || params.commands.at(0) === "pull")) {
    consola.error("The mode is configured with 'migrateMode = \"generate\"', but you are trying to execute the push or pull command. To avoid accidental command execution, this command has been stopped.");
    exit(1);
  }

  const command = `${cookbookToml.general.packageManager} run drizzle ${userCommand ?? params.commands.join(" ")}`;

  if (!(await exists(join(project.path, "drizzle.config.ts")))) return;
  if (!(await exists(join(project.path, ".milkio")))) await mkdir(join(project.path, ".milkio"));

  progress.open("cookbook building..");
  const { initWatcher } = await import("../watcher");
  await initWatcher(cookbookToml, mode.mode, false);
  progress.close("");

  env.DATABASE_URL = mode.migrateDatabaseUrl;
  process.env.DATABASE_URL = mode.migrateDatabaseUrl;

  await execScript(command, {
    cwd: project.path,
    env: {
      ...env,
      DATABASE_URL: mode.migrateDatabaseUrl,
    },
  });

  if (params.commands.at(0) === "generate") {
    const journal = JSON.parse(await readFile(join(cwd(), "projects", project.value, "drizzle", "meta", "_journal.json"), "utf-8"));
    for (const entry of journal.entries) {
      entry.sql = await readFile(join(cwd(), "projects", project.value, "drizzle", `${entry.tag}.sql`), "utf-8");
    }

    await writeFile(join(cwd(), "projects", project.value, ".milkio", "drizzle-migrations.ts"), `export const drizzleMigrations = ${JSON.stringify(journal)}`);

    consola.success("Drizzle migration successfully generated.");
    if (existsSync(join(cwd(), "projects", project.value, "drizzle.migrate.ts"))) {
      await import(join(cwd(), "projects", project.value, "drizzle.migrate.ts"));
    } else {
      consola.info("If you want to automatically execute the `migrate` command after `generate`, you can try creating a `drizzle.migrate.ts` file, which will be automatically executed by the cookbook.");
    }
  }
});
