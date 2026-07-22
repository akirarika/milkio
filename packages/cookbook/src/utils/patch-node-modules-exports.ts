import { ensureTypiaExportsPatched } from "./patch-typia-exports.ts";
import { ensureEstreeWalkerExportsPatched } from "./patch-estree-walker-exports.ts";

// 统一收口：修正 node_modules 中上游包有缺陷的 package.json exports。
// 在 dev/start/test/build/install 等命令启动时无条件调用，确保无论
// typia CLI 是否运行、缓存是否命中，node_modules 都处于已修复状态。
export async function ensureNodeModulesExportsPatched(root: string): Promise<void> {
  await ensureTypiaExportsPatched(root);
  await ensureEstreeWalkerExportsPatched(root);
}
