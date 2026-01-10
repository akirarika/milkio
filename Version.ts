import { join } from "node:path";
import { cli } from "./.commands/utils/cli.ts";
import { exists, readFile, writeFile } from "node:fs/promises";
import consola from "consola";
import { $ } from "bun";

const mainPackage = "milkio";
const childPackages = [
  // 这些包将会被发布，不在列表中的包不会被发布
  "cookbook",
  "create-cookbook",
  "milkio-electron",
  "cookbook-command",
  "milkio-astra",
  "milkio-redis",
  "milkio-stargate",
  "milkio-stargate-worker",
  "vite-plugin-milkio",
  "template-milkio",
  "template-cookbook",
];

async function main() {
  const cwd = join(process.cwd());

  if (!mainPackage) {
    consola.error("mainPackage is empty");
    process.exit(1);
  }

  const packageJson = JSON.parse(
    await readFile(join(cwd, "packages", mainPackage, "package.json"), "utf-8"),
  );

  const LatestVersion = packageJson.version;
  consola.success(`当前版本为: ${LatestVersion}`);

  const packagesTocheck = [mainPackage, ...childPackages];
  let newVersion = "";
  while (true) {
    newVersion = (await cli.input("要发布的新版本号是:")) ?? "";
    if (!newVersion) {
      consola.info("版本号不能为空，请重新输入");
      continue;
    }
    if (!/^(\d+)\.(\d+)\.(\d+)((-rc|-beta|-alpha)\.(\d+))?$/.test(newVersion)) {
      console.log("错误的版本号，未能满足正则表达式的校验，请重新输入");
      continue;
    }
    console.clear();
    consola.info(`检查 npm 版本是否存在...`);
    let hasConflict = false;
    for (const packageName of packagesTocheck) {
      const packageJson = JSON.parse(
        await readFile(join(cwd, "packages", packageName, "package.json"), "utf-8"),
      );
      try {
        await $`npm view ${packageJson.name}@${newVersion} --json`.quiet();
        consola.error(`已存在${packageJson.name}@${newVersion}`);
        hasConflict = true;
      } catch {
        consola.success(`可以发布 ${packageJson.name}@${newVersion}`);
      }
    }
    if (hasConflict) {
      consola.warn("检测到至少一个包该版本已存在，请重新输入版本号。");
      continue;
    }
    break;
  }
  if ((await cli.select("是否进行版本号修改", ["是", "否"])) === "是") {
    packageJson.version = newVersion;
    await writeFile(
      join(cwd, "packages", mainPackage, "package.json"),
      JSON.stringify(packageJson, null, 2),
    );
    for (const childpackage of childPackages) {
      const childPackageJson = JSON.parse(
        await readFile(join(cwd, "packages", childpackage, "package.json"), "utf-8"),
      );
      childPackageJson.version = newVersion;
      await writeFile(
        join(cwd, "packages", childpackage, "package.json"),
        JSON.stringify(childPackageJson, null, 2),
      );

      if (await exists(join(cwd, "packages", childpackage, "template", "package.json"))) {
        const templatePackageJson = JSON.parse(
          await readFile(join(cwd, "packages", childpackage, "template", "package.json"), "utf-8"),
        );

        if (templatePackageJson.peerDependencies) {
          for (const dep in templatePackageJson.peerDependencies) {
            if (dep.startsWith("@milkio/") || dep === "milkio") {
              templatePackageJson.peerDependencies[dep] = newVersion;
            }
          }
        }

        if (templatePackageJson.dependencies) {
          for (const dep in templatePackageJson.dependencies) {
            if (dep.startsWith("@milkio/") || dep === "milkio") {
              templatePackageJson.dependencies[dep] = newVersion;
            }
          }
        }

        if (templatePackageJson.devDependencies) {
          for (const dep in templatePackageJson.devDependencies) {
            if (dep.startsWith("@milkio/") || dep === "milkio") {
              templatePackageJson.devDependencies[dep] = newVersion;
            }
          }
        }

        await writeFile(
          join(cwd, "packages", childpackage, "template", "package.json"),
          JSON.stringify(templatePackageJson, null, 2),
        );
      }
    }
    for (const childPackage of [mainPackage, ...childPackages]) {
      if (childPackage === "create-cookbook" || childPackage === "milkio-elecrton") {
        await Bun.write(
          join(cwd, "packages", childPackage, "__VERSION__.mjs"),
          `export const __VERSION__ = '${newVersion}'`,
        );
      } else {
        await Bun.write(
          join(cwd, "packages", childPackage, "__VERSION__.ts"),
          `export const __VERSION__ = '${newVersion}'`,
        );
      }
    }
    consola.success("所有包的版本号已修改");
  }
}
main().catch((error) => {
  console.error("发布过程中出现错误:", error);
  process.exit(1);
});
