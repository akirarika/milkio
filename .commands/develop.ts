#!/usr/bin/env bun

import { $ } from "bun";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, copyFile } from "node:fs/promises";
import { cwd } from "node:process";
import { execFileSync } from "node:child_process";
import consola from "consola";

const tasks: Array<any> = [];

tasks.push(
  (async () => {
    async function copyDir(src: string, dest: string) {
      await mkdir(dest, { recursive: true });
      const entries = await readdir(src, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);
        entry.isDirectory() ? await copyDir(srcPath, destPath) : await copyFile(srcPath, destPath);
      }
    }

    if (!(await existsSync(join(cwd(), "../canto-projects/projects/cookbook-ui/package.json")))) return;
    execFileSync("bun", ["run", "generate"], { stdio: "inherit", shell: true, cwd: join(cwd(), "../canto-projects/projects/cookbook-ui") });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      await copyDir(join(cwd(), "../canto-projects/projects/cookbook-ui/.output/public"), join(cwd(), "./node_modules/.cookbook-ui"));
    } catch (error) {
      consola.warn("cookbook-ui copy failed");
    }
  })(),
);

await Promise.all(tasks);

if (process.platform !== "win32") await $`chmod +x ./node_modules/.bin/cookbook`;
