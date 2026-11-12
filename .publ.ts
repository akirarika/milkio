/**
 * 发布脚本（完全非交互，供 AI / CI 调用）
 *
 * 行为：
 * 1. 计算版本号（命令行参数 > 环境变量 VERSION > 自动 patch +1）
 * 2. 检查 npm 上是否已存在该版本（任一包冲突则中止）
 * 3. 写入所有包的版本号 / __VERSION__ / 模板的 peerDependencies
 * 4. git add -A && git commit && git push（推送后由 GitHub Actions 发布）
 * 5. 等待发布完成：静默等待 15 分钟，随后以 5 分钟为频率轮询 npm，
 *    直到所有包在 npm 上可见；超时上限 45 分钟，仍有缺失则如实汇报并以退出码 1 结束。
 *    传入 --skip-wait 可跳过该阶段。
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

// 等待发布完成的节奏：静默 15 分钟 → 每 5 分钟轮询一次 → 45 分钟超时。
const SILENT_WAIT_MS = 15 * 60 * 1000;
const POLL_INTERVAL_MS = 5 * 60 * 1000;
const PUBLISH_TIMEOUT_MS = 45 * 60 * 1000;

// --skip-wait 跳过“等待发布完成”阶段；其余以 - 开头的参数均视为标志，位置参数才是版本号。
const argv = process.argv.slice(2);
const SKIP_WAIT = argv.includes("--skip-wait");
const versionArg = argv.find((arg) => !arg.startsWith("-"));

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
        // --prefer-online 绕过本地元数据缓存，否则轮询阶段可能永远读到旧 packument。
        run(
            npmBin(),
            ["view", "--prefer-online", `${packageName}@${version}`, "version", "--json"],
            { capture: true },
        );
        return true;
    } catch (error: any) {
        const output = String(error?.message ?? "");
        if (/E404|404 Not Found|No match found|ETARGET|not found/i.test(output)) return false;
        throw error;
    }
}

/** 所有待发布包在 npm 上的真实包名（package.json 的 name）。 */
async function resolvePackageNames(): Promise<string[]> {
    const names: string[] = [];
    for (const directory of [mainPackage, ...childPackages]) {
        const packageJson = await readJson<{ name: string }>(
            join(cwd, "packages", directory, "package.json"),
        );
        names.push(packageJson.name);
    }
    return names;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 等待 GitHub Actions 发布流水线完成：静默等待 15 分钟后，以 5 分钟为频率轮询 npm，
 * 直到所有包都可见；超过 45 分钟仍有缺失则抛出错误（如实汇报缺失包）。
 */
async function waitForPublished(packageNames: string[], version: string): Promise<void> {
    const deadline = Date.now() + PUBLISH_TIMEOUT_MS;
    await sleep(SILENT_WAIT_MS);

    while (true) {
        const missing: string[] = [];
        for (const packageName of packageNames) {
            try {
                if (!npmVersionExists(packageName, version)) missing.push(packageName);
            } catch (error: any) {
                // 网络/registry 抖动不算“已发布”，本轮记为缺失，下一轮重试。
                logger.warn(
                    `查询 ${packageName} 失败：${error instanceof Error ? error.message : String(error)}`,
                );
                missing.push(packageName);
            }
        }

        if (missing.length === 0) {
            logger.success(`全部 ${packageNames.length} 个包已在 npm 上可见：v${version}`);
            return;
        }

        // 最后一次检查落在超时点上，且不因定时器漂移而提前终止。
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
            throw new Error(
                `等待发布完成超时（${PUBLISH_TIMEOUT_MS / 60000} 分钟），` +
                    `以下 ${missing.length} 个包在 npm 上仍未找到：\n` +
                    missing.map((name) => `  - ${name}@${version}`).join("\n"),
            );
        }

        logger.info(
            `已发布 ${packageNames.length - missing.length}/${packageNames.length}，` +
                `尚未就绪：${missing.join("、")}（剩余 ${Math.ceil(remaining / 60000)} 分钟）`,
        );
        await sleep(Math.min(POLL_INTERVAL_MS, remaining));
    }
}

async function main() {
    const packageJsonPath = join(cwd, "packages", mainPackage, "package.json");
    const packageJson = await readJson<{ version: string; name: string }>(packageJsonPath);

    const latestVersion = packageJson.version;
    logger.success(`当前版本为: ${latestVersion}`);

    // 版本号：命令行参数 > 环境变量 VERSION > 自动递增 patch；全程不读 stdin。
    let newVersion = versionArg || process.env.VERSION || "";
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
    const packageNames = await resolvePackageNames();
    let hasConflict = false;
    for (const packageName of packageNames) {
        if (npmVersionExists(packageName, newVersion)) {
            logger.error(`已存在 ${packageName}@${newVersion}`);
            hasConflict = true;
        } else {
            logger.success(`可以发布 ${packageName}@${newVersion}`);
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

    if (SKIP_WAIT) {
        logger.info("已传入 --skip-wait，跳过等待发布完成阶段");
        return;
    }

    await waitForPublished(packageNames, newVersion);
}

main().catch((error) => {
    logger.error(`发布过程中出现错误: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
