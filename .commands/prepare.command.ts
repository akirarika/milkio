import path from "node:path";
import fs from "fs-extra";
import type { CopyOptions } from "fs-extra";

import { defineCookbookCommand } from "@milkio/cookbook-command";

export default await defineCookbookCommand(async (utils) => {
  /**
   * ------------------------------------------------------------------------------------------------
   * @step Copy the test examples from test-bun to other runtimes
   * ------------------------------------------------------------------------------------------------
   */
  const PROJECT_BASE = "./projects";
  const SOURCE_PROJECT = "test";
  const TARGET_PROJECTS = ["test-bun", "test-deno"];
  const DIRS_TO_COPY = ["app"];

  const COPY_OPTIONS: CopyOptions = {
    overwrite: true,
    preserveTimestamps: false,
    errorOnExist: false,
  };

  const sourcePath = path.join(PROJECT_BASE, SOURCE_PROJECT);
  if (!(await fs.pathExists(sourcePath))) {
    throw new Error(`Not found: ${sourcePath}`);
  }
  await Promise.all(
    TARGET_PROJECTS.map(async (target) => {
      const targetPath = path.join(PROJECT_BASE, target);

      await fs.ensureDir(targetPath);

      await Promise.all(
        DIRS_TO_COPY.map(async (dir) => {
          const sourceDir = path.join(sourcePath, dir);
          const targetDir = path.join(targetPath, dir);

          if (await fs.pathExists(targetDir)) {
            await fs.remove(targetDir);
          }

          if (await fs.pathExists(sourceDir)) {
            console.log(`copy: ${sourceDir} -> ${targetDir}`);
            await fs.copy(sourceDir, targetDir, COPY_OPTIONS);
          }
        }),
      );
    }),
  );
});
