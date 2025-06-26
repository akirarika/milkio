#!/usr/bin/env node

import { __VERSION__ } from "./__VERSION__.mjs";
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

  const workspace = process.platform === "win32"
    ? join(process.env.USERPROFILE, ".cookbook")
    : join(process.env.HOME, ".cookbook");

  const tempspace = join(workspace, ".temp");
  if (!existsSync(workspace)) mkdirSync(workspace);
  if (!existsSync(tempspace)) mkdirSync(tempspace);

  const packageName = `@milkio/cookbook-${process.platform}-${os.arch()}`;
  const selectedVersion = __VERSION__;
  let selectedMirror = "";

  consola.start(color("Finding the appropriate mirror.."));
  const mirrors = [
    "https://registry.npmjs.org/",
    "https://registry.npmmirror.com/",
    "https://mirrors.cloud.tencent.com/npm/",
    "https://cdn.jsdelivr.net/npm/"
  ];

  for (const mirror of mirrors) {
    try {
      consola.info(color(`Trying mirror: ${mirror}`));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${mirror}${packageName}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) continue;

      const packageInfo = await response.json();
      if (!packageInfo || !packageInfo["dist-tags"] || !packageInfo["dist-tags"].latest) continue;

      selectedMirror = mirror;
      consola.success(color(`Found version ${selectedVersion} at ${mirror}`));
      break;
    } catch (error) {
      consola.warn(color(`Mirror unavailable: ${error.message}`));
    }
  }

  if (!selectedMirror) {
    consola.error(color("Failed to detect latest version from all mirrors"));
    exit(1);
  }

  const downloadUrl = `${selectedMirror}${packageName}/-/${packageName.split('/')[1]}-${selectedVersion}.tgz`;
  consola.start(color(`Downloading package from ${downloadUrl}`));

  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const destination = join(tempspace, "package.tgz");
    if (existsSync(destination)) await remove(destination);

    const fileStream = createWriteStream(destination);
    await finished(Readable.fromWeb(res.body).pipe(fileStream));
    consola.success(color("Package downloaded successfully"));
  } catch (error) {
    consola.error(color(`Download failed: ${error.message}`));
    exit(1);
  }

  consola.start(color("Extracting package.."));
  try {
    await compressing.tgz.uncompress(join(tempspace, "package.tgz"), tempspace);
    consola.success(color("Package extracted"));
  } catch (error) {
    consola.error(color(`Extraction failed: ${error.message}`));
    exit(1);
  }

  const execName = process.platform === "win32" ? "co.exe" : "co";
  const execPath = join(tempspace, "package", execName);

  if (!existsSync(execPath)) {
    consola.error(color("Executable not found in package"));
    exit(1);
  }

  if (installPath) {
    consola.start(color(`Installing to custom path: ${installPath}`));
    if (!existsSync(installPath)) mkdirSync(installPath, { recursive: true });
    await move(execPath, join(installPath, execName), { overwrite: true });
  } else {
    consola.start(color("Finding suitable installation location.."));

    let targetPath = "";
    if (process.platform === "win32") {
      targetPath = join(process.env.USERPROFILE, ".cookbook");
      if (!existsSync(targetPath)) mkdirSync(targetPath);

      consola.info(color(`Installing to ${targetPath}`));
      await move(execPath, join(targetPath, execName), { overwrite: true });

      try {
        execFileSync("powershell.exe", [
          "-Command",
          `[System.Environment]::SetEnvironmentVariable('PATH', $env:PATH + ';${targetPath}', 'User')`
        ]);
        consola.success(color("Added to PATH (requires restart)"));
      } catch {
        consola.warn(color("Manual PATH configuration required"));
      }
    } else {
      const searchPaths = [
        join(process.env.HOME, "bin"),
        join(process.env.HOME, ".local", "bin"),
        "/usr/local/bin"
      ];

      for (const path of searchPaths) {
        if (existsSync(path)) {
          targetPath = path;
          break;
        }
      }

      if (!targetPath) {
        targetPath = join(process.env.HOME, "bin");
        mkdirSync(targetPath, { recursive: true });
      }

      consola.info(color(`Installing to ${targetPath}`));
      const targetFile = join(targetPath, "co");
      if (existsSync(targetFile)) rmSync(targetFile);

      try {
        consola.info(color(`Moving executable to PATH: ${targetPath}`));
        await move(execPath, targetFile, { overwrite: true });
      } catch (error) {
        consola.error(color(`Installation failed: ${error?.message}`));
        exit(1);
      }

      try {
        execFileSync("chmod", ["+x", targetFile]);
        consola.success(color("Executable permissions set"));
      } catch (error) {
        consola.error(color(`Permission setting failed: ${error?.message}`));
        exit(1);
      }
    }
  }

  consola.start(color("Cleaning temporary files.."));
  try {
    await remove(tempspace);
    consola.success(color("Installation complete"));
  } catch (error) {
    consola.warn(color(`Cleanup failed: ${error.message}`));
  }

  console.log("");
  consola.success(color("Cookbook installed successfully!"))

  console.log(color("△ Try running: co --version"));
  if (process.platform === "win32") {
    console.log(color("△ Note: You may need to restart your terminal for PATH changes to take effect"));
  }
})();