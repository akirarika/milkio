import consola from "consola";
import { exists, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd, exit } from "node:process";
import { select } from "./select";
import { homedir } from "node:os";

export async function handleNonCookbookPkgMgr(): Promise<string | undefined> {
  if (await exists(join(cwd(), "cookbook.toml"))) return undefined;
  if ((await exists(join(cwd(), "..", "cookbook.toml"))) && join(homedir(), "cookbook.toml") !== join(cwd(), "..", "cookbook.toml")) {
    consola.error("Please run this command in the root directory of the cookbook monorepo, not in a cookbook internal.");
    exit(1);
  }
  if ((await exists(join(cwd(), "..", "..", "cookbook.toml"))) && join(homedir(), "cookbook.toml") !== join(cwd(), "..", "..", "cookbook.toml")) {
    consola.error("Please run this command in the root directory of the cookbook monorepo, not in a cookbook project internal.");
    exit(1);
  }

  let pkgMgr: string | undefined;
  if (!(await exists(join(cwd(), ".pkgrc")))) {
    consola.warn("This is not a cookbook monorepo, so you need to tell me which package manager you want to use. I will store your configuration in the.pkgrc file, and you won't have to make the same selection again in the future.");
    const packageManager = await select("Which package manager do you want to use:", [{ value: "npm" }, { value: "bun" }, { value: "yarn" }, { value: "pnpm" }], "value");
    pkgMgr = packageManager.value;
    await writeFile(join(cwd(), ".pkgrc"), packageManager.value);
  }
  if (!pkgMgr) pkgMgr = await readFile(join(cwd(), ".pkgrc"), "utf-8");

  return pkgMgr;
}
