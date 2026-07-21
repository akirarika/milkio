import { defineCookbookCommand } from "@milkio/cookbook-command";
import consola from "consola";
import chalk from "chalk";
import { finished } from "node:stream/promises";
import { copySync, createWriteStream, existsSync, mkdirSync, remove, renameSync } from "fs-extra";
import { join, basename, dirname } from "node:path";
import { cwd, exit } from "node:process";
import { __VERSION__ } from "../../__VERSION__";
import { Readable } from "node:stream";
import compressing from "compressing";
import { exists, readdir as readdirAsync, stat as statAsync, readFile, writeFile } from "node:fs/promises";
import { execScript, execScriptOrFail } from "../utils/exec-script";
import { fetchWithTimeout } from "../utils/fetch-with-timeout";
import { progress } from "../progress";

export default await defineCookbookCommand(async (utils, inputPackageName?: string) => {
    const params = utils.getParams();

    let packageName = inputPackageName ?? params.commands[0];
    if (!packageName) {
        consola.error("Package name is required");
        exit(1);
    }

    const cookbookToml = await utils.getCookbookToml();
    const packageManager = cookbookToml.general.packageManager;

    if (!packageName.startsWith("@milkio/template-")) {
        const projectsDir = join(cwd(), "projects");
        const before = new Set(await readdirAsync(projectsDir).catch(() => [] as string[]));

        if (packageManager === "deno") await execScriptOrFail(`deno init --npm ${packageName}`, { cwd: projectsDir });
        else await execScriptOrFail(`${packageManager} create ${packageName}`, { cwd: projectsDir });

        const after = await readdirAsync(projectsDir);
        const newDirs = after.filter((d) => !before.has(d));

        if (newDirs.length === 0) {
            consola.warn("No new project directory was detected. Skipping port allocation and cookbook.toml registration.");
            return;
        }
        if (newDirs.length > 1) {
            consola.warn(`Multiple new directories detected: ${newDirs.join(", ")}. Skipping port allocation and cookbook.toml registration.`);
            return;
        }

        const projectName = newDirs[0];
        const projectDir = join(projectsDir, projectName);

        let maxPort = 8999;
        if (cookbookToml.projects && typeof cookbookToml.projects === "object" && Object.keys(cookbookToml.projects).length > 0) {
            for (const [_projectNameKey, projectConfig] of Object.entries(cookbookToml.projects)) {
                if (projectConfig.port && projectConfig.port > maxPort) {
                    maxPort = projectConfig.port;
                }
            }
        }
        const newPort = maxPort + 1;

        const cookbookTomlPath = join(cwd(), "cookbook.toml");
        if (await exists(cookbookTomlPath)) {
            let cookbookContent = await readFile(cookbookTomlPath, "utf8");
            const currentCookbookToml: any = Bun.TOML.parse(cookbookContent);
            if (!currentCookbookToml?.projects?.[projectName]) {
                const projectConfig = `\n\n[projects.${projectName}]\nport = ${newPort}\ntype = "custom"\nautoStart = true`;
                cookbookContent += projectConfig;
                await writeFile(cookbookTomlPath, cookbookContent, "utf8");
                consola.success(`Registered "${projectName}" in cookbook.toml with port ${newPort}.`);
            }
        }

        const nuxtConfigPath = join(projectDir, "nuxt.config.ts");
        if (await exists(nuxtConfigPath)) {
            let nuxtConfigContent = await readFile(nuxtConfigPath, "utf8");
            if (nuxtConfigContent.includes("devServer")) {
                nuxtConfigContent = nuxtConfigContent.replace(/port:\s*\d+/g, `port: ${newPort}`);
            } else {
                nuxtConfigContent = nuxtConfigContent.replace(
                    /(defineNuxtConfig\(\{)([\s\S]*?)(\}\)\s*$)/,
                    (_, open, inner, close) => {
                        const trimmed = inner.trimEnd();
                        const hasContent = trimmed.length > 0 && !trimmed.endsWith(",");
                        const separator = hasContent ? ",\n" : "\n";
                        return `${open}${trimmed}${separator}  devServer: {\n    port: ${newPort},\n  },\n${close}`;
                    },
                );
            }
            await writeFile(nuxtConfigPath, nuxtConfigContent, "utf8");
            consola.success(`Updated nuxt.config.ts devServer.port to ${newPort}.`);
        } else {
            console.log(
                `\n${chalk.yellow.bold("⚠️  Port Configuration Required")}\n` +
                `${chalk.gray("-".repeat(16))}\n` +
                `The project "${chalk.bold(projectName)}" was created successfully, but its dev server port was not automatically configured.\n\n` +
                `${chalk.cyan("Why this matters:")}\n` +
                `  When you have multiple frontend projects in the same monorepo, their dev servers\n` +
                `  often default to the same port (e.g. Nuxt defaults to 3000, Vite to 5173, Next.js to 3000).\n` +
                `  If two projects try to listen on the same port, one will fail to start.\n` +
                `  Cookbook automatically assigns a unique port (${chalk.bold(newPort)}) to this project in\n` +
                `  cookbook.toml, but your project's own config file needs to match.\n\n` +
                `${chalk.cyan("What to do:")}\n` +
                `  1. Open your project's config file (e.g. ${chalk.bold("vite.config.ts")}, ${chalk.bold("next.config.ts")}, etc.)\n` +
                `  2. Find the dev server / port setting and change it to ${chalk.bold(newPort)}\n` +
                `  3. Make sure it matches the port in ${chalk.bold("cookbook.toml")}:\n\n` +
                `     ${chalk.gray(`[projects.${projectName}]`)}\n` +
                `     ${chalk.gray(`port = ${newPort}`)}\n` +
                `     ${chalk.gray(`type = "custom"`)}\n` +
                `     ${chalk.gray(`autoStart = true`)}\n\n` +
                `  4. Restart your dev server with ${chalk.magenta("co dev")}\n`
            );
        }
    } else {
        consola.info("We will create a new Milkio project in the ./projects directory, how about an impressive name?");
        let projectName = await utils.inputString({
            env: "PROJECT",
            message: "project name",
        });

        if (projectName === undefined) {
            consola.error("Project name is required");
            exit(1);
        }

        while (!/^[a-z]+(-[a-z]+)*$/.test(projectName)) {
            consola.error("Project name must be in lowercase letters with hyphens (e.g., 'my-project', 'example-app')");

            projectName = await utils.inputString({
                env: "PROJECT",
                message: "project name",
            });

            if (projectName === undefined) {
                consola.error("Project name is required");
                exit(1);
            }
        }

        if (await exists(join(cwd(), "projects", projectName))) {
            consola.error(`Project ${projectName} already exists`);
            exit(1);
        }

        const workspace = process.platform === "win32" ? join(process.env.USERPROFILE!, ".cookbook") : join(process.env.HOME!, ".cookbook");
        const tempspace = join(workspace, ".temp");
        if (!existsSync(workspace)) mkdirSync(workspace);
        if (!existsSync(tempspace)) mkdirSync(tempspace);

        let currentWriteDir = cwd();
        if (await exists(join(currentWriteDir, "packages", "cookbook", "src", "commands", "init.ts"))) {
            const tempDir = join(tempspace, `${Date.now()}`);
            currentWriteDir = await utils.inputString({
                message: "The current directory seems to be a cookbook project. Please enter the directory you want to initialize the cookbook in",
                env: "COOKBOOK_INIT_DIR",
                placeholder: tempDir,
            });
            if (currentWriteDir === undefined) currentWriteDir = tempDir;
            consola.info(`Initializing cookbook in ${currentWriteDir}`);
            if (!await exists(currentWriteDir)) mkdirSync(currentWriteDir);
        }

        consola.start("Finding the appropriate mirror..");
        let selectedVersion = "";
        let selectedMirror = "";
        const mirrors = [
            "https://registry.npmjs.org/",
            "https://registry.npmmirror.com/",
            "https://mirrors.cloud.tencent.com/npm/",
            "https://cdn.jsdelivr.net/npm/"
        ];

        for (const mirror of mirrors) {
            try {
                consola.info(`Trying mirror: ${mirror}`);
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                const response = await fetch(`${mirror}${packageName}`, {
                    signal: controller.signal,
                });
                clearTimeout(timeout);

                if (!response.ok) continue;

                const packageInfo: any = await response.json();
                if (!packageInfo || !packageInfo["dist-tags"] || !packageInfo["dist-tags"].latest) continue;

                selectedMirror = mirror;
                selectedVersion = packageInfo["dist-tags"].latest;
                consola.success(`Found version ${selectedVersion} at ${mirror}`);
                break;
            } catch (error: any) {
                consola.warn(`Mirror unavailable: ${error?.message ?? error}`);
            }
        }

        if (!selectedMirror) {
            consola.error("Failed to detect latest version from all mirrors");
            exit(1);
        }

        const downloadUrl = `${selectedMirror}${packageName}/-/${packageName.split('/')[1]}-${selectedVersion}.tgz`;
        consola.start(`Downloading package from ${downloadUrl}`);

        try {
            const res = await fetchWithTimeout(downloadUrl, { timeout: 60000 });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const destination = join(tempspace, "package.tgz");
            if (existsSync(destination)) await remove(destination);

            const fileStream = createWriteStream(destination);
            await finished(Readable.fromWeb(res.body!).pipe(fileStream));
            consola.success("Package downloaded successfully");
        } catch (error: any) {
            consola.error(`Download failed: ${error?.message ?? error}`);
            exit(1);
        }

        consola.start("Extracting package..");
        try {
            const tempExtractDir = join(tempspace, `extract-${Date.now()}`);
            if (!existsSync(tempExtractDir)) mkdirSync(tempExtractDir);
            await compressing.tgz.uncompress(join(tempspace, "package.tgz"), tempExtractDir);
            const templateDir = join(tempExtractDir, "package", "template");
            if (!existsSync(templateDir)) {
                consola.error("Template directory not found in package");
                exit(1);
            }

            const projectsDir = join(currentWriteDir, "projects");
            if (!existsSync(projectsDir)) mkdirSync(projectsDir);

            const projectDir = join(projectsDir, projectName);
            if (!existsSync(projectDir)) mkdirSync(projectDir);

            copySync(templateDir, projectDir);
            await remove(tempExtractDir);
            await remove(join(tempspace, "package.tgz"));
            consola.success("Package extracted and temporary.");

            currentWriteDir = projectDir;
        } catch (error: any) {
            consola.error(`Extraction failed: ${error?.message ?? error}`);
            exit(1);
        }

        consola.start("Processing template files...");

        const processFile = async (filePath: string, projectName: string) => {
            try {
                const stats = await statAsync(filePath);
                if (stats.isDirectory()) {
                    const files = await readdirAsync(filePath);
                    await Promise.all(files.map(file => processFile(join(filePath, file), projectName)));
                    return;
                }
                if (stats.size > 1024 * 1024) return;

                const fileName = basename(filePath);
                if (fileName.endsWith('.template')) {
                    const newFileName = fileName.slice(0, -9);
                    const newFilePath = join(dirname(filePath), newFileName);
                    renameSync(filePath, newFilePath);
                    consola.info(`Renamed ${fileName} to ${newFileName}`);
                    filePath = newFilePath;
                }

                const content = await readFile(filePath, 'utf8');
                if (content.includes('REPLACE-YOUR-REPOSITORY-NAME')) {
                    const newContent = content.replace(/REPLACE-YOUR-REPOSITORY-NAME/g, projectName);
                    await writeFile(filePath, newContent, 'utf8');
                }
            } catch (error: any) {
                consola.warn(`Failed to process file ${filePath}: ${error?.message ?? error}`);
            }
        };

        try {
            await processFile(currentWriteDir, projectName);
            consola.success("Template processing completed successfully");
        } catch (error: any) {
            consola.error(`Template processing failed: ${error?.message ?? error}`);
            exit(1);
        }

        let maxPort = 8999;

        if (cookbookToml.projects && typeof cookbookToml.projects === 'object' && Object.keys(cookbookToml.projects).length > 0) {
            for (const [_projectNameKey, projectConfig] of Object.entries(cookbookToml.projects)) {
                if (projectConfig.port && projectConfig.port > maxPort) {
                    maxPort = projectConfig.port;
                }
            }
        }

        const newPort = maxPort + 1;
        const viteConfigPath = join(currentWriteDir, "vite.config.ts");
        if (await exists(viteConfigPath)) {
            let viteConfigContent = await readFile(viteConfigPath, 'utf8');
            viteConfigContent = viteConfigContent.replace(/port: 9000,/g, `port: ${newPort},`);
            await writeFile(viteConfigPath, viteConfigContent, 'utf8');
        }

        const astraPath = join(currentWriteDir, "app", "utils", "astra.ts");
        if (await exists(astraPath)) {
            let astraContent = await readFile(astraPath, 'utf8');
            astraContent = astraContent.replace(/baseUrl: "http:\/\/localhost:9000",/g, `baseUrl: "http://localhost:${newPort}",`);
            await writeFile(astraPath, astraContent, 'utf8');
        }

        const cookbookTomlPath = join(currentWriteDir, "cookbook.toml");
        if (await exists(cookbookTomlPath)) {
            let cookbookContent = await readFile(cookbookTomlPath, 'utf8');
            const currentCookbookToml: any = Bun.TOML.parse(cookbookContent);
            if (!currentCookbookToml?.projects?.[projectName]) {
                const projectConfig = `\n\n[projects.${projectName}]\nport = ${newPort}\ntype = "milkio"\nruntime = "node"\nautoStart = true`;
                cookbookContent += projectConfig;
                await writeFile(cookbookTomlPath, cookbookContent, 'utf8');
            }
        }

        progress.open("Installing dependencies..");
        try {
            const installExitCode = await execScript(`${packageManager} i`, { cwd: currentWriteDir });
            if (installExitCode !== 0) {
                progress.close("Failed to install dependencies.");
                consola.error(`Installation failed with exit code ${installExitCode}`);
                exit(1);
            }
        } catch (error: any) {
            progress.close("Failed to install dependencies.");
            consola.error(`Installation failed: ${error?.message ?? error}`);
            exit(1);
        }
        progress.close("Dependencies installed.");

        console.log(
            `\n\n${chalk.green.bold("🎉 Project Created Successfully!")}\n` +
            `${chalk.gray("-".repeat(16))}\n` +
            `${chalk.cyan("Name:")}       ${chalk.bold(projectName)}\n` +
            `${chalk.cyan("Location:")}   ${chalk.bold(join(currentWriteDir, "projects", projectName))}\n` +
            `${chalk.cyan("Template:")}   ${chalk.bold(packageName)}\n` +
            `${chalk.gray("-".repeat(16))}\n\n` +
            `${chalk.blue.bold("💡 Tips:")}\n` +
            `  This is a monorepo project. You can place your frontend and backend code\n` +
            `  in the project directory, then edit ${chalk.yellow("cookbook.toml")} to have them start together.\n\n` +
            `${chalk.green.bold("✨ Example:")}\n` +
            `  Try running ${chalk.magenta("co create nuxt")} to create a ${chalk.green("Vue (nuxt)")} project!\n\n` +
            `${chalk.yellow.bold("🚀 Get Started:")}\n` +
            `  Run ${chalk.magenta("co dev")} to start your project!\n\n` +
            `${chalk.gray("Happy coding UwU! 🌟")}\n`
        );
    }
});
