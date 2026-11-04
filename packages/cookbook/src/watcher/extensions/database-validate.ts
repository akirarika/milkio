import { defineWatcherExtension } from "../extensions";
import { exit } from "node:process";
import consola from "consola";

/**
 * 校验每个 table 文件是否位于模块的 `$databases` 目录下：
 *
 *   app/modules/<module>/$databases/*.table.ts
 *
 * 表定义放在其它目录不会报类型错误，但不符合模块约定，因此在此提前拦截。
 */
export const databaseValidateWatcherExtension = defineWatcherExtension({
  async: false,

  filter: (file) => {
    return file.type === "table";
  },

  setup: async (root, mode, options, project, changeFiles, allFiles) => {
    for (const file of allFiles) {
      // 最后一段是文件名，前面的是目录段
      const directoryParts = file.parts.slice(0, -1);
      if (!directoryParts.includes("$databases")) {
        consola.error(`[database-validate] "${file.path}" must be placed under a $databases directory. Database tables must be defined in app/modules/<module>/$databases/*.table.ts.`);
        exit(1);
      }
    }
  },
});
