#!/usr/bin/env node

import os from "node:os";
import { join } from "node:path";
import { exit } from "node:process";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, createWriteStream, rmSync } from "node:fs";
import { remove, move } from "fs-extra";
import consola from "consola";
import gradient from "gradient-string";
import compressing from "compressing";

const colorLong = gradient(["cyan", "green"]);
const color = gradient(["cyan", "#2d9b87"]);

(async () => {
  const args = process.argv.slice(2);
  let version = "latest";
  let installPath = undefined;
  for (const arg of args) {
    if (arg.startsWith("--version=")) {
      version = arg.slice(10);
    } else {
      installPath = arg;
    }
  }

  const workspace = process.platform === "win32" ? join(process.env.USERPROFILE, ".cookbook") : join(process.env.HOME, ".cookbook");
  const tempspace = process.platform === "win32" ? join(process.env.USERPROFILE, ".cookbook", ".temp") : join(process.env.HOME, ".cookbook", ".temp");
  if (!existsSync(workspace)) mkdirSync(workspace);
  if (!existsSync(tempspace)) mkdirSync(tempspace);

  const uiName = "@milkio/cookbook-ui";
  const cookbookName = `@milkio/cookbook-${process.platform}-${os.arch()}`;
  let uiPackageInfo;
  let cookbookPackageInfo;
  console.log("");
  for (const mirror of ["https://registry.npmjs.org/", "https://registry.npmmirror.com/", "https://mirrors.cloud.tencent.com/npm/", "https://cdn.jsdelivr.net/npm/"]) {
    try {
      consola.start(color(`[1/2] Checking (${mirror}${uiName})..`));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${mirror}${uiName}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.status !== 200) continue;
      const json = await response.json();
      if (json.name !== uiName) continue;
      uiPackageInfo = {
        mirror,
        json,
      };
      break;
    } catch (error) {
      // biome-ignore lint/correctness/noUnnecessaryContinue: <explanation>
      continue;
    }
  }
  if (!uiPackageInfo) {
    consola.error(color("Network connection failed!"));
    exit(1);
  }
  for (const mirror of ["https://registry.npmjs.org/", "https://registry.npmmirror.com/", "https://mirrors.cloud.tencent.com/npm/", "https://cdn.jsdelivr.net/npm/"]) {
    try {
      consola.start(color(`[2/2] Checking (${mirror}${cookbookName})..`));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${mirror}${cookbookName}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.status !== 200) continue;
      const json = await response.json();
      if (json.name !== cookbookName) continue;
      cookbookPackageInfo = {
        mirror,
        json,
      };
      break;
    } catch (error) {
      // biome-ignore lint/correctness/noUnnecessaryContinue: <explanation>
      continue;
    }
  }
  if (!cookbookPackageInfo) {
    consola.error(color("Network connection failed!"));
    exit(1);
  }

  const uiUrl = `${cookbookPackageInfo.mirror}${uiName}/-/cookbook-ui-${version === "latest" ? uiPackageInfo.json["dist-tags"].latest : version}.tgz`;
  consola.start(uiUrl);
  consola.start(color(`[1/2] Downloading Cookbook UI (${uiUrl})..`));
  await utils.downloadFile(uiUrl, tempspace, "ui.tgz");
  consola.success(color("[1/2] Downloaded!"));
  const uiExtractPromise = (async () => {
    if (!existsSync(join(tempspace, "ui"))) mkdirSync(join(tempspace, "ui"));
    await compressing.tgz.uncompress(join(tempspace, "ui.tgz"), join(tempspace, "ui"));
  })();

  const cookbookUrl = `${cookbookPackageInfo.mirror}${cookbookName}/-/cookbook-${process.platform}-${os.arch()}-${version === "latest" ? cookbookPackageInfo.json["dist-tags"].latest : version}.tgz`;
  consola.start(cookbookUrl);
  consola.start(color(`[2/2] Downloading Cookbook Core (${cookbookUrl})..`));
  await utils.downloadFile(cookbookUrl, tempspace, "cookbook.tgz");
  consola.success(color("[2/2] Downloaded!"));
  const cookbookExtractPromise = (async () => {
    await compressing.tgz.uncompress(join(tempspace, "cookbook.tgz"), tempspace);
  })();

  consola.start(color("[1/2] Extracting.."));
  await Promise.all([uiExtractPromise, cookbookExtractPromise]);
  consola.success(color("[1/2] Extracted!"));

  consola.success(color("[2/2] Installing.."));
  await utils.mvToPathAndInstall(installPath, join(tempspace, "package"), process.platform === "win32" ? "co.exe" : "co");
  await utils.mvUIDir(join(tempspace, "ui", "package"));
  await utils.tempspaceClean(tempspace);
  consola.success(color("[2/2] Installed!"));

  console.log("");
  consola.info(color("Try run: co version"));
  consola.info(colorLong("* If you find that the co command does not exist, try restarting your Terminal or System"));
})();

const utils = {
  downloadFile: async (url, workspace, filename) => {
    const res = await fetch(url);
    if (existsSync(join(workspace, filename))) await remove(join(workspace, filename));
    const destination = join(workspace, filename);
    const fileStream = createWriteStream(destination, { flags: "wx" });
    await finished(Readable.fromWeb(res.body).pipe(fileStream));
  },
  mvUIDir: async (tempspace) => {
    if (!existsSync(process.env.HOME || process.env.USERPROFILE, ".cookbook")) mkdirSync(join(process.env.HOME || process.env.USERPROFILE, ".cookbook"));
    if (process.platform === "win32") {
      if (existsSync(join(process.env.USERPROFILE, ".cookbook", "ui"))) await utils.executePowershell(`Remove-Item -Recurse -Force "${join(process.env.USERPROFILE, ".cookbook", "ui")}";`);
      await utils.executePowershell(`Move-Item -Path "${join(tempspace)}" -Destination "${join(process.env.USERPROFILE, ".cookbook", "ui")}" -Force;`);
      return;
    }
    if (process.platform === "linux") {
      if (existsSync(join(process.env.HOME, ".cookbook", "ui"))) await utils.executeBash(`rm -rf "${join(process.env.HOME, ".cookbook", "ui")}";`);
      await utils.executeBash(`mv "${join(tempspace)}" "${join(process.env.HOME, ".cookbook", "ui")}"`);
    }
    if (process.platform === "darwin") {
      if (existsSync(join(process.env.HOME, ".cookbook", "ui"))) await utils.executeBash(`rm -rf "${join(process.env.HOME, ".cookbook", "ui")}";`);
      await utils.executeBash(`mv "${join(tempspace)}" "${join(process.env.HOME, ".cookbook", "ui")}"`);
    }
  },
  tempspaceClean: async (tempspace) => {
    if (process.platform === "win32") {
      if (existsSync(join(tempspace))) await utils.executePowershell(`Remove-Item -Recurse -Force "${join(tempspace)}";`);
      return;
    }
    if (process.platform === "linux") {
      if (existsSync(join(tempspace))) await utils.executeBash(`rm -rf "${join(tempspace)}"`);
    }
    if (process.platform === "darwin") {
      if (existsSync(join(tempspace))) await utils.executeBash(`rm -rf "${join(tempspace)}"`);
    }
  },
  mvToPathAndInstall: async (installPath, workspace, filename) => {
    if (installPath) {
      if (!existsSync(installPath)) mkdirSync(installPath, { recursive: true });
      await move(join(workspace, filename), join(installPath, filename), { overwrite: true });
      return;
    }
    if (process.platform === "win32") {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!(process.env.PATH.includes(`${join(process.env.USERPROFILE, ".cookbook")};`) || process.env.PATH.includes(`;${join(process.env.USERPROFILE, ".cookbook")}`) || process.env.PATH === `${join(process.env.USERPROFILE, ".cookbook")}`)) {
        await utils.executePowershell(`[System.Environment]::SetEnvironmentVariable("PATH", [System.Environment]::GetEnvironmentVariable("PATH", "User") + ";${join(process.env.USERPROFILE, ".cookbook")}", "User");`);
      }
      if (!existsSync(process.env.USERPROFILE, ".cookbook")) mkdirSync(process.env.USERPROFILE, ".cookbook");
      if (existsSync(join(process.env.USERPROFILE, ".cookbook", filename))) rmSync(join(process.env.USERPROFILE, ".cookbook", filename));
      await utils.executePowershell(`Move-Item -Path "${join(workspace, filename)}" -Destination "${join(process.env.USERPROFILE, ".cookbook")}";`);
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
        else await utils.executeBash(`rm -f ${join(pathChecked, filename)}`);
      }
      if (pathChecked.startsWith("/home")) await utils.executeBash(`mv ${join(workspace, filename)} ${pathChecked} && chmod +x ${join(pathChecked, filename)}`);
      else await utils.executeBash(`mv ${join(workspace, filename)} ${pathChecked} && chmod +x ${join(pathChecked, filename)}`);
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
        else await utils.executeBash(`rm -f ${join(pathChecked, filename)}`);
      }
      if (pathChecked.startsWith("/Users")) await utils.executeBash(`mv ${join(workspace, filename)} ${pathChecked} && chmod +x ${join(pathChecked, filename)}`);
      else await utils.executeBash(`mv ${join(workspace, filename)} ${pathChecked} && chmod +x ${join(pathChecked, filename)}`);
    }
  },
  executePowershell: async (script) => {
    return execFileSync("powershell.exe", ["-c", script], {
      stdio: "inherit",
    });
  },
  executeBash: (script) => {
    return execFileSync("bash", ["-c", `if command -v sudo &>/dev/null; then sudo ${script}; else ${script}; fi`], {
      stdio: "inherit",
    });
  },
};
