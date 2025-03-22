import consola from "consola";
import { join } from "node:path";
import { cwd, exit } from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import { defineCookbookCommand } from "@milkio/cookbook-command";

export default await defineCookbookCommand(async (utils) => {
  const packageJson = JSON.parse(await readFile(join(cwd(), "package.json"), "utf-8"));
  const lastMilkioVersion = packageJson?.dependencies?.milkio ?? packageJson?.peerDependencies?.milkio;
  if (!lastMilkioVersion) {
    consola.error("Milkio is not installed in this project.");
    exit(0);
  }

  const result = await consola.prompt("Which version do you want to upgrade cookbook and milkio to?", {
    type: "text",
    placeholder: lastMilkioVersion,
  });

  if (typeof result !== "string" || !/^(\d+)\.(\d+)\.(\d+)((-rc|-beta|-alpha)\.(\d+))?$/.test(result)) {
    consola.error("The version number is not entered or the format is incorrect.");
    exit(0);
  }

  if ("dependencies" in packageJson) {
    for (const key in packageJson.dependencies) {
      if (key === "milkio" || key.startsWith("@milkio/")) packageJson.dependencies[key] = result;
    }
  }

  if ("devDependencies" in packageJson) {
    for (const key in packageJson.devDependencies) {
      if (key === "milkio" || key.startsWith("@milkio/")) packageJson.devDependencies[key] = result;
    }
  }

  if ("peerDependencies" in packageJson) {
    for (const key in packageJson.peerDependencies) {
      if (key === "milkio" || key.startsWith("@milkio/")) packageJson.peerDependencies[key] = result;
    }
  }

  await writeFile(join(cwd(), "package.json"), JSON.stringify(packageJson, null, 2));

  console.log("");
  console.log("△ Milkio upgrade!");
  console.log("△ Run the installation command, such as: bun i");
  console.log("");
});
