import consola from "consola";
import { join } from "node:path";
import { cwd } from "node:process";
import { exists } from "node:fs/promises";
import { exit } from "node:process";

let ttscPath: Promise<string> | null = null;

// typia 14.0.0 移除了 CLI（lib/executable/typia.js），改用 ttsc 插件机制。
// ttsc 在 transform 时自动通过 ttsc.plugin 发现并构建 typia 的 Go transformer。
// 这里返回 ttsc CLI 路径（用于 route-typia 的 transform 命令）。
export function getTypiaPath(): Promise<string> {
  if (ttscPath) return ttscPath;
  ttscPath = (async () => {
    let ttscPath = join(cwd(), "./node_modules/ttsc/lib/launcher/ttsc.js");
    if (!(await exists(ttscPath))) ttscPath = join(cwd(), "../../node_modules/ttsc/lib/launcher/ttsc.js");
    if (!(await exists(ttscPath))) {
      consola.error(`ttsc is not installed, so it cannot be found in the following path: ${ttscPath}`);
      exit(1);
    }
    return ttscPath;
  })();
  return ttscPath;
}
