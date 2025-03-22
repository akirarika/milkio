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
  const project = await selectProject(cookbookToml, async (project) => await exists(join(cwd(), "projects", project.value, "prisma")));
  if (!project) exit(0);
  const packageJson = await readFile(join(cwd(), "projects", project.value, "package.json"), "utf-8");
  const packageJsonParsed = JSON.parse(packageJson);
  if (packageJsonParsed?.scripts?.prisma === undefined || packageJsonParsed.scripts.prisma === "") {
    if (!packageJsonParsed) packageJsonParsed.scripts = {};
    packageJsonParsed.scripts.prisma = "prisma";
    await writeFile(join(cwd(), "projects", project.value, "package.json"), JSON.stringify(packageJsonParsed, null, 2));
  }
  const mode = await select("Select the mode:", project.prisma ?? [], "mode");
  const command = `${cookbookToml.general.packageManager} run prisma ${mode?.migrateMode === "push" ? "db push" : "migrate dev"}`;
  execScript(command, {
    cwd: project.path,
    env: {
      ...env,
      DATABASE_URL: mode.databaseUrl,
    },
  });
  exit(0);
});
