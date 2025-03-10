#!/usr/bin/env node

import os from "node:os";
import { join } from "node:path";
import { exit } from "node:process";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, createWriteStream, rmSync } from "node:fs";
import { remove } from "fs-extra";
import consola from "consola";
import gradient from "gradient-string";
import * as tar from "tar";

const colorLong = gradient(["cyan", "green"]);
const color = gradient(["cyan", "#2d9b87"]);

(async () => {
    let workspace = process.platform === "win32" ? join(process.env.USERPROFILE, ".cookbook") : join(process.env.HOME, ".cookbook");
    let tempspace = process.platform === "win32" ? join(process.env.USERPROFILE, ".cookbook", ".temp") : join(process.env.HOME, ".cookbook", ".temp");
    if (!existsSync(workspace)) mkdirSync(workspace);
    if (!existsSync(tempspace)) mkdirSync(tempspace);

    const name = `@milkio/cookbook-${process.platform}-${os.arch()}`;
    let packageInfo;
    for (const mirror of ["https://registry.npmjs.org/", "https://registry.npmmirror.com/", "https://mirrors.cloud.tencent.com/npm/", "https://cdn.jsdelivr.net/npm/"]) {
        try {
            console.log("");
            consola.start(color(`Checking (${mirror}${name})..`));
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(`${mirror}${name}`, {
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (response.status !== 200) continue;
            const json = await response.json();
            if (json.name !== name) continue;
            packageInfo = {
                mirror,
                json,
            };
            break;
        } catch (error) {
            continue;
        }
    }
    if (!packageInfo) {
        consola.error(color("Network connection failed!"));
        exit(1);
    }

    const url = `${packageInfo.mirror}${name}/-/cookbook-${process.platform}-${os.arch()}-${packageInfo.json["dist-tags"].latest}.tgz`;
    console.log(url)
    consola.start(url);
    consola.start(color(`Downloading..`));
    await utils.downloadFile(url, tempspace, "cookbook.tgz");
    consola.success(color("Downloaded!"));

    consola.start(color(`Extracting..`));
    await tar.extract({
        file: join(tempspace, "cookbook.tgz"),
        cwd: tempspace,
    });
    await utils.mvToPathAndClean(join(tempspace, "package"), process.platform === "win32" ? "co.exe" : "co", tempspace);
    consola.success(color("Extracted!"));

    console.log("");
    consola.info(color(`Try run: co version`));
    consola.info(colorLong(`If you find that the co command does not exist, try restarting your Terminal or System`));
})();

const utils = {
    downloadFile: async (url, workspace, filename) => {
        const res = await fetch(url);
        if (existsSync(join(workspace, filename))) await remove(join(workspace, filename));
        const destination = join(workspace, filename);
        const fileStream = createWriteStream(destination, { flags: "wx" });
        await finished(Readable.fromWeb(res.body).pipe(fileStream));
    },
    mvToPathAndClean: async (workspace, filename, tempspace) => {
        if (process.platform === "win32") {
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (!(process.env.PATH.includes(`${join(process.env.USERPROFILE, ".cookbook")};`) || process.env.PATH.includes(`;${join(process.env.USERPROFILE, ".cookbook")}`) || process.env.PATH === `${join(process.env.USERPROFILE, ".cookbook")}`)) {
                await utils.executePowershell(`[System.Environment]::SetEnvironmentVariable("PATH", [System.Environment]::GetEnvironmentVariable("PATH", "User") + ";${join(process.env.USERPROFILE, ".cookbook")}", "User");`);
            }
            if (!existsSync(process.env.USERPROFILE, ".cookbook")) mkdirSync(process.env.USERPROFILE, ".cookbook");
            if (existsSync(join(process.env.USERPROFILE, ".cookbook", filename))) rmSync(join(process.env.USERPROFILE, ".cookbook", filename));
            await utils.executePowershell(`Move-Item -Path "${join(workspace, filename)}" -Destination "${join(process.env.USERPROFILE, ".cookbook")}";`);
            await utils.executePowershell(`Remove-Item -Recurse -Force "${join(tempspace)}";`);
            return;
        }
        if (process.platform === "linux") {
            const paths = [join(process.env.HOME, ".bin"), "/usr/bin/", "/usr/sbin"];
            let pathChecked = "";
            for (const path of paths) {
                if (process.env.PATH.includes(`${path}:`) || process.env.PATH.includes(`:${path}`) || process.env.PATH === `${path}`) {
                    pathChecked = path;
                    break;
                }
            }
            if (!pathChecked) {
                consola.error(color("No path found!"));
                exit(0);
            }
            if (!existsSync(pathChecked)) mkdirSync(pathChecked);
            if (existsSync(join(pathChecked, filename))) {
                if (pathChecked.startsWith("/home")) await utils.executeBash(`rm -f ${join(pathChecked, filename)}`);
                else await utils.executeBash(`sudo rm -f ${join(pathChecked, filename)}`);
            }
            if (pathChecked.startsWith("/home")) await utils.executeBash(`mv ${join(workspace, filename)} ${pathChecked} && chmod +x ${join(pathChecked, filename)} && rm -rf ${join(tempspace)}`);
            else await utils.executeBash(`sudo mv ${join(workspace, filename)} ${pathChecked} && sudo chmod +x ${join(pathChecked, filename)} && sudo rm -rf ${join(tempspace)}`);
        }
        if (process.platform === "darwin") {
            const paths = [join(process.env.HOME, "bin"), join(process.env.HOME, ".bin"), join(process.env.HOME, ".local", "bin"), "/usr/local/bin"];
            let pathChecked = "";
            for (const path of paths) {
                if (process.env.PATH.includes(`${path}:`) || process.env.PATH.includes(`:${path}`) || process.env.PATH === `${path}`) {
                    pathChecked = path;
                    break;
                }
            }
            if (!pathChecked) {
                consola.error(color("No path found!"));
                exit(0);
            }
            if (!existsSync(pathChecked)) mkdirSync(pathChecked);
            if (existsSync(join(pathChecked, filename))) {
                if (pathChecked.startsWith("/Users")) await utils.executeBash(`rm -f ${join(pathChecked, filename)}`);
                else await utils.executeBash(`sudo rm -f ${join(pathChecked, filename)}`);
            }
            if (pathChecked.startsWith("/Users")) await utils.executeBash(`mv ${join(workspace, filename)} ${pathChecked} && chmod +x ${join(pathChecked, filename)} && rm -rf ${join(tempspace)}`);
            else await utils.executeBash(`sudo mv ${join(workspace, filename)} ${pathChecked} && sudo chmod +x ${join(pathChecked, filename)} && sudo rm -rf ${join(tempspace)}`);
        }
    },
    executePowershell: async (script) => {
        return execFileSync("powershell.exe", ["-c", script], {
            stdio: "inherit",
        });
    },
    executeBash: (script) => {
        return execFileSync("bash", ["-c", script], {
            stdio: "inherit",
        });
    },
};