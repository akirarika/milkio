import { defineCookbookCommand } from "@milkio/cookbook-command";
import consola from "consola";
import { finished } from "node:stream/promises";
import { copySync, createWriteStream, existsSync, mkdirSync, readdir, remove, renameSync } from "fs-extra";
import { join, basename, dirname } from "node:path";
import { cwd, exit } from "node:process";
import { __VERSION__ } from "../../__VERSION__";
import { Readable } from "node:stream";
import compressing from "compressing";
import { exists, readdir as readdirAsync, stat as statAsync, readFile, writeFile } from "node:fs/promises";

export default await defineCookbookCommand(async (utils) => {
    const packageName = `@milkio/template-cookbook`;

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
    } else {
        for (const fileName of (await readdir(currentWriteDir))) {
            if (fileName === '.git') continue;
            consola.error(`The current directory doesn't seem to be empty. You need to run this command in an empty directory.`);
            exit(1);
        }
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
        const res = await fetch(downloadUrl);
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
        copySync(templateDir, currentWriteDir);
        await remove(tempExtractDir);
        await remove(join(tempspace, "package.tgz"));
        consola.success("Package extracted and temporary.");
    } catch (error: any) {
        consola.error(`Extraction failed: ${error?.message ?? error}`);
        exit(1);
    }

    consola.start("Processing template files...");

    const projectName = basename(currentWriteDir);
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

    consola.success("✨ Initialized successfully! Now, let's create your first Milkio project.");
    console.log("");
    await (await (import("./create.ts"))).default(utils, "@milkio/template-milkio");
});
