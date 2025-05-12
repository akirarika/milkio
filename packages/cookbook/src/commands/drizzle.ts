import { cwd, exit } from "node:process";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import { selectProject } from "../utils/select-project";
import { join } from "node:path";
import { exists, readFile, writeFile } from "node:fs/promises";
import { execScript } from "../utils/exec-script";
import { select } from "../utils/select";
import { env } from "bun";

export default await defineCookbookCommand(async (utils) => {
  const cookbookToml = await utils.getCookbookToml();
  const project = await selectProject(cookbookToml, {
    filter: async (project) => {
      return (
        (await exists(join(cwd(), "projects", project.value, "drizzle"))) ||
        (await exists(
          join(cwd(), "projects", project.value, "drizzle.config.ts")
        ))
      );
    },
  });
  if (!project) exit(0);
  const packageJson = await readFile(
    join(cwd(), "projects", project.value, "package.json"),
    "utf-8"
  );
  const packageJsonParsed = JSON.parse(packageJson);
  if (
    packageJsonParsed?.scripts?.drizzle === undefined ||
    packageJsonParsed.scripts.drizzle === ""
  ) {
    if (!packageJsonParsed) packageJsonParsed.scripts = {};
    packageJsonParsed.scripts.drizzle = "drizzle-kit";
    await writeFile(
      join(cwd(), "projects", project.value, "package.json"),
      JSON.stringify(packageJsonParsed, null, 2)
    );
  }
  const mode = await select("Select the mode:", project.drizzle ?? [], "mode");
  const command = `${cookbookToml.general.packageManager} run drizzle ${
    mode?.migrateMode === "push" ? "push" : "generate"
  }`;
  execScript(command, {
    cwd: project.path,
    env: {
      ...env,
      DATABASE_URL: mode.migrateDatabaseUrl,
    },
  });
});
