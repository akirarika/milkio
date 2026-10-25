/**
 * 发布脚本（完全非交互，供 AI / CI 调用）
 *
 * 行为：
 * 1. 计算版本号（命令行参数 > 环境变量 VERSION > 自动 patch +1）
 * 2. 检查 npm 上是否已存在该版本（任一包冲突则中止）
 * 3. 写入所有包的版本号 / __VERSION__ / 模板的 peerDependencies
 * 4. git add -A && git commit && git push（推送后由 GitHub Actions 发布）
 *
 * 说明：
 * - 本脚本用 `node .publ.ts` 直接运行（Node 26 原生 TypeScript 类型擦除），
 *   因此不能依赖 tsx/ts-node，也不能依赖只在子包里安装的 consola 等依赖。
 * - 全流程无任何 Y/n 确认：版本号必须通过参数/环境变量/自动递增确定，不读取 stdin。
 * - DRY_RUN=1 时只做只读检查并打印将要执行的变更，不写文件、不提交、不推送。
 */
import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const mainPackage = "milkio";
const childPackages = [
    // 这些包将会被发布，不在列表中的包不会被发布
    "cookbook",
    "create-cookbook",
    "milkio-electron",
    "cookbook-command",
    "milkio-astra",
    "milkio-drizzle",
    "milkio-redis",
    "milkio-stargate",
    "milkio-stargate-worker",
    "vite-plugin-milkio",
    "template-milkio",
    "template-cookbook",
];

const DRY_RUN = process.env.DRY_RUN === "1";
const cwd = process.cwd();

// 极简 logger：不引入 consola 等外部依赖，保证 `node .publ.ts` 在仓库根目录可直接运行。
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code: number) => (text: string) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const logger = {
    info: (message: string) => console.log(paint(36)(`ℹ ${message}`)),
    success: (message: string) => console.log(paint(32)(`✔ ${message}`)),
    warn: (message: string) => console.log(paint(33)(`⚠ ${message}`)),
    error: (message: string) => console.error(paint(31)(`✖ ${message}`)),
};

// Windows 上 npm 是 npm.cmd，直接 execFileSync("npm") 会 ENOENT，必须走 shell。
function npmBin(): string {
    return process.platform === "win32" ? "npm.cmd" : "npm";
}

function needsShell(command: string): boolean {
    return process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
}

// shell: true 与 args 同时使用在 Node 22+ 会触发 DEP0190 警告，因此 .cmd（npm）改为
// 拼好命令行后以单参数形式交给 shell；参数全部来自本脚本的受控值（包名/版本号/固定参数）。
function quoteWin(arg: string): string {
    return /[\s"&|<>^]/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg;
}

function run(
    command: string,
    args: string[],
    options?: { cwd?: string; capture?: boolean },
): string {
    const useShell = needsShell(command);
    const file = useShell ? [command, ...args].map(quoteWin).join(" ") : command;
    try {
        const output = execFileSync(file, useShell ? [] : args, {
            cwd: options?.cwd ?? cwd,
            encoding: "utf-8",
            // 非交互：凭据缺失时直接失败，而不是等待终端输入。
            // 注意：不要设置 GCM_INTERACTIVE=never —— Git Credential Manager 在该模式下
            // 连已保存的凭据都不会返回，会导致 push 直接 401/无法读取用户名。
            env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
            stdio: options?.capture ? "pipe" : "inherit",
            shell: useShell,
        });
        return typeof output === "string" ? output : "";
    } catch (error: any) {
        const details = `${error?.stdout ?? ""}${error?.stderr ?? ""}`.trim();
        throw new Error(
            `命令执行失败: ${command} ${args.join(" ")}` +
                (details ? `\n${details}` : "") +
                (error?.message ? `\n${error.message}` : ""),
        );
    }
}

async function readJson<T>(path: string): Promise<T> {
    return JSON.parse(await readFile(path, "utf-8")) as T;
}

// 保留原文件是否有结尾换行，避免版本提交里出现无意义的 EOF 差异。
async function writeJson(path: string, data: unknown): Promise<void> {
    const raw = await readFile(path, "utf-8");
    const trailing = raw.endsWith("\n") ? "\n" : "";
    await writeFile(path, JSON.stringify(data, null, 2) + trailing);
}

async function writeVersionModule(path: string, version: string): Promise<void> {
    const marker = await readFile(path, "utf-8");
    const trailing = marker.endsWith("\n") ? "\n" : "";
    await writeFile(path, `export const __VERSION__ = '${version}'` + trailing);
}

/** 该版本是否已存在于 npm；网络/registry 异常会抛出，避免误判为“可发布”。 */
function npmVersionExists(packageName: string, version: string): boolean {
    try {
        run(npmBin(), ["view", `${packageName}@${version}`, "version", "--json"], { capture: true });
        return true;
    } catch (error: any) {
        const output = String(error?.message ?? "");
        if (/E404|404 Not Found|No match found|ETARGET|not found/i.test(output)) return false;
        throw error;
    }
}

async function main() {
    const packageJsonPath = join(cwd, "packages", mainPackage, "package.json");
    const packageJson = await readJson<{ version: string; name: string }>(packageJsonPath);

    const latestVersion = packageJson.version;
    logger.success(`当前版本为: ${latestVersion}`);

    // 版本号：命令行参数 > 环境变量 VERSION > 自动递增 patch；全程不读 stdin。
    let newVersion = process.argv[2] || process.env.VERSION || "";
    if (!newVersion) {
        const [major, minor, patch] = latestVersion.split(".").map(Number);
        newVersion = `${major}.${minor}.${patch + 1}`;
        logger.info(`未指定版本号，自动递增为: ${newVersion}`);
    } else {
        logger.info(`使用指定版本号: ${newVersion}`);
    }
    if (!/^(\d+)\.(\d+)\.(\d+)((-rc|-beta|-alpha)\.(\d+))?$/.test(newVersion)) {
        throw new Error("错误的版本号，未能满足正则表达式的校验");
    }

    // 推送前先确认远端可达，避免改完版本号才发现没有网络。
    logger.info("检查远端仓库连通性...");
    run("git", ["ls-remote", "--exit-code", "origin", "refs/heads/master"], { capture: true });
    logger.success("远端仓库可达");

    logger.info("检查 npm 版本是否存在...");
    const packagesToCheck = [mainPackage, ...childPackages];
    let hasConflict = false;
    for (const packageName of packagesToCheck) {
        const pkgJson = await readJson<{ name: string }>(join(cwd, "packages", packageName, "package.json"));
        if (npmVersionExists(pkgJson.name, newVersion)) {
            logger.error(`已存在 ${pkgJson.name}@${newVersion}`);
            hasConflict = true;
        } else {
            logger.success(`可以发布 ${pkgJson.name}@${newVersion}`);
        }
    }
    if (hasConflict) {
        throw new Error("检测到至少一个包该版本已存在，请使用不同的版本号。");
    }

    if (DRY_RUN) {
        logger.warn(`[dry-run] 跳过写入版本号 / git commit / git push（目标版本 ${newVersion}）`);
        return;
    }

    packageJson.version = newVersion;
    await writeJson(packageJsonPath, packageJson);

    for (const childPackage of childPackages) {
        const childPackageJsonPath = join(cwd, "packages", childPackage, "package.json");
        const childPackageJson = await readJson<any>(childPackageJsonPath);
        childPackageJson.version = newVersion;
        await writeJson(childPackageJsonPath, childPackageJson);

        // 模板工程的自引用依赖也要跟随版本，否则 `npm create` 拉的模板会指向旧版本。
        const templatePackageJsonPath = join(cwd, "packages", childPackage, "template", "package.json");
        if (existsSync(templatePackageJsonPath)) {
            const templatePackageJson = await readJson<any>(templatePackageJsonPath);
            for (const field of ["peerDependencies", "dependencies", "devDependencies"] as const) {
                const deps = templatePackageJson[field];
                if (!deps) continue;
                for (const dep in deps) {
                    if (dep.startsWith("@milkio/") || dep === "milkio") deps[dep] = newVersion;
                }
            }
            await writeJson(templatePackageJsonPath, templatePackageJson);
        }
    }

    for (const childPackage of [mainPackage, ...childPackages]) {
        const fileName = childPackage === "create-cookbook" || childPackage === "milkio-electron" ? "__VERSION__.mjs" : "__VERSION__.ts";
        await writeVersionModule(join(cwd, "packages", childPackage, fileName), newVersion);
    }
    logger.success("所有包的版本号已修改");

    logger.info("正在提交版本变更...");
    run("git", ["add", "-A"]);
    const staged = run("git", ["status", "--porcelain"], { capture: true }).trim();
    if (staged === "") {
        logger.warn("没有需要提交的变更，跳过 commit");
    } else {
        run("git", ["commit", "-m", `v${newVersion}`]);
    }

    logger.info("正在推送到远程仓库...");
    run("git", ["push", "origin", "HEAD"]);
    logger.success(`已推送 v${newVersion}，发布流水线已触发`);
}

main().catch((error) => {
    logger.error(`发布过程中出现错误: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
