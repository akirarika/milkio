import { defineWatcherExtension } from "../extensions";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { exit } from "node:process";
import consola from "consola";

/**
 * 校验每个 action / stream 文件是否遵循导出约定：
 *
 *   1. `type Params = {`（不可导出）— 请求参数类型
 *   2. 空行
 *   3. `type Result = {`（action）或 `type Result = AsyncGenerator<{`（stream），不可导出
 *   4. 空行
 *   5. handler 函数（单行声明）
 *
 * 三者必须按此顺序出现，且之间以空行分隔。
 * 找到 handler 后立即停止遍历该文件。
 * 使用 indexOf 实现顺序扫描，O(n) 且常数因子最小。
 */
export const routeValidateWatcherExtension = defineWatcherExtension({
  async: false,

  filter: (file) => {
    return file.path.startsWith("modules/") && (file.type === "action" || file.type === "stream");
  },

  setup: async (root, mode, options, project, changeFiles, allFiles) => {
    for (const file of allFiles) {
      const filePath = join(file.projectFsPath, file.path);
      const raw = await readFile(filePath, "utf-8");
      const content = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      const isStream = file.type === "stream";

      const paramsStr = "\ntype Params = {";
      const resultTag = isStream ? "\ntype Result = AsyncGenerator<{" : "\ntype Result = {";
      const handlerTag = isStream
        ? "\nexport async function* handler(context: MilkioContext, params: Params): Result {"
        : "\nexport async function handler(context: MilkioContext, params: Params): Promise<Result> {";

      const p1 = content.indexOf(paramsStr);
      if (p1 === -1) {
        consola.error(`[route-validate] "${file.path}" 缺少 type Params = { 定义`);
        exit(1);
      }

      // 找到 Result（单 \n 匹配），再验证与 Params 之间有空行
      const p2 = content.indexOf(resultTag, p1 + 1);
      if (p2 === -1) {
        consola.error(`[route-validate] "${file.path}" 缺少 type Result = 定义（必须在 Params 之后）`);
        exit(1);
      }
      if (!content.substring(p1, p2 + 1).includes("\n\n")) {
        consola.error(`[route-validate] "${file.path}" type Params 与 type Result 之间需要空行分隔`);
        exit(1);
      }

      // 找到 handler（单 \n 匹配），再验证与 Result 之间有空行
      const p3 = content.indexOf(handlerTag, p2 + 1);
      if (p3 === -1) {
        consola.error(`[route-validate] "${file.path}" 缺少 handler 函数定义（必须在 Result 之后）`);
        exit(1);
      }
      if (!content.substring(p2, p3 + 1).includes("\n\n")) {
        consola.error(`[route-validate] "${file.path}" type Result 与 handler 之间需要空行分隔`);
        exit(1);
      }

      // 找到 handler，停止遍历此文件
    }
  },
});
