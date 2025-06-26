import consola from "consola";
import { join } from "node:path";
import { cwd, exit } from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import gradient from "gradient-string";
import { $ } from "bun";

export default await defineCookbookCommand(async (utils) => {
  const params = utils.getParams();
  const cookbookToml = await utils.getCookbookToml();
  const packageJson = JSON.parse(await readFile(join(cwd(), "package.json"), "utf-8"));

  const color = gradient(["cyan", "#2d9b87"]);

  let result = params.commands[0] || "";
  if (!result) {
    result = await consola.prompt("Which version do you want to upgrade cookbook and milkio to?", {
      type: "text",
      placeholder: "latest",
    });
  }

  if (typeof result === "symbol") {
    consola.error("Cancelled.");
    exit(0);
  }

  if (typeof result === "string" && !/^(\d+)\.(\d+)\.(\d+)((-rc|-beta|-alpha)\.(\d+))?$/.test(result) && result !== "latest") {
    consola.error("The version number is not entered or the format is incorrect.");
    exit(0);
  }

  if (!result || result === "latest") {
    const packageName = "milkio";
    const MIRRORS = ["https://registry.npmjs.org/", "https://registry.npmmirror.com/", "https://mirrors.cloud.tencent.com/npm/", "https://cdn.jsdelivr.net/npm/"];

    let packageInfo: any = null;

    for (const mirror of MIRRORS) {
      const packageUrl = `${mirror}${packageName}`;

      try {
        consola.start(`Checking package on mirror: ${mirror}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(packageUrl, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          consola.info(`Unavailable response from ${mirror}`);
          continue;
        }

        const jsonData: any = await response.json();
        if (jsonData.name !== packageName) {
          consola.info(`Invalid package data from ${mirror}`);
          continue;
        }

        packageInfo = { mirror, data: jsonData };
        consola.success(`Package found on mirror: ${mirror}`);
        break;
      } catch (error) {
        const errorType = error instanceof Error ? error.message : "Unknown error";
        consola.info(`Mirror ${mirror} failed: ${errorType}`);
      }
    }

    if (!packageInfo) {
      consola.error(`All mirrors failed to provide valid data for package '${packageName}'`);
      exit(0);
    }

    result = packageInfo.data["dist-tags"].latest;
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

  const cmd = `${cookbookToml.general.packageManager} install`;
  if (await consola.prompt(`Do you want to install dependencies now? (${cmd})`, { type: "confirm" })) {
    try {
      await $`${{ raw: cmd }}`;
    } catch (error) {
      consola.warn("Failed to install dependencies, please run it manually.");
    }
  }

  console.log("");
  consola.info(color("△ Milkio upgrade completed!"));
  consola.info(color("△ Also remember to upgrade your cookbook by running:"));
  consola.info(color(`     ${cookbookToml.general.packageManager} create cookbook@${result}`));
});
