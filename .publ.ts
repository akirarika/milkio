import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import consola from "consola";
import { execFileSync } from "node:child_process";

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

function $(command: string, args: string[], options?: { cwd?: string }) {
    try {
        return execFileSync(command, args, {
            cwd: options?.cwd,
            encoding: "utf-8",
            stdio: "pipe",
        });
    } catch (error: any) {
        throw error;
    }
}

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
    // 获取新版本号：命令行参数 > 环境变量 VERSION > 自动递增 patch 版本
    let newVersion = process.argv[2] || process.env.VERSION || "";
    if (!newVersion) {
        const [major, minor, patch] = LatestVersion.split(".").map(Number);
        newVersion = `${major}.${minor}.${patch + 1}`;
        consola.info(`未指定版本号，自动递增为: ${newVersion}`);
    } else {
        consola.info(`使用指定版本号: ${newVersion}`);
    }
    if (!/^(\d+)\.(\d+)\.(\d+)((-rc|-beta|-alpha)\.(\d+))?$/.test(newVersion)) {
        consola.error("错误的版本号，未能满足正则表达式的校验");
        process.exit(1);
    }
    consola.info(`检查 npm 版本是否存在...`);
    let hasConflict = false;
    for (const packageName of packagesTocheck) {
        const pkgJson = JSON.parse(
            await readFile(join(cwd, "packages", packageName, "package.json"), "utf-8"),
        );
        try {
            $("npm", ["view", `${pkgJson.name}@${newVersion}`, "--json"]);
            consola.error(`已存在${pkgJson.name}@${newVersion}`);
            hasConflict = true;
        } catch {
            consola.success(`可以发布 ${pkgJson.name}@${newVersion}`);
        }
    }
    if (hasConflict) {
        consola.error("检测到至少一个包该版本已存在，请使用不同的版本号。");
        process.exit(1);
    }

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

        if (existsSync(join(cwd, "packages", childpackage, "template", "package.json"))) {
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
            await writeFile(
                join(cwd, "packages", childPackage, "__VERSION__.mjs"),
                `export const __VERSION__ = '${newVersion}'`,
            );
        } else {
            await writeFile(
                join(cwd, "packages", childPackage, "__VERSION__.ts"),
                `export const __VERSION__ = '${newVersion}'`,
            );
        }
    }
    consola.success("所有包的版本号已修改");

    consola.info("正在提交版本变更...");
    $("git", ["add", "-A"], { cwd });
    $("git", ["commit", "-m", `v${newVersion}`], { cwd });
    consola.info("正在推送到远程仓库...");
    $("git", ["push"], { cwd });
    consola.success(`已推送 v${newVersion}，发布流水线已触发`);
}
main().catch((error) => {
    console.error("发布过程中出现错误:", error);
    process.exit(1);
});
