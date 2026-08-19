import { defineCookbookCommand } from "@milkio/cookbook-command";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { join } from "node:path";
import { cwd, exit } from "node:process";
import consola from "consola";
import { selectMode } from "../utils/select-mode";
import { progress } from "../progress";
import { calcHash } from "../utils/calc-hash";

export default await defineCookbookCommand(async (utils) => {
  const cookbookToml = Bun.file(join(cwd(), "cookbook.toml"));
  if (!(await cookbookToml.exists())) {
    consola.error(
      `The "cookbook.toml" file does not exist in the current directory: ${join(cwd())}`,
    );
    consola.info(`Hint: run "co init" in an empty directory to create a new cookbook project.`);
    exit(1);
  }
  const cookbookTomlText = await cookbookToml.text();
  const cookbookTomlHash = calcHash(cookbookTomlText);
  const options = await getCookbookToml(cookbookTomlText, progress);
  options.hash = cookbookTomlHash;

  const mode = await selectMode(options);

  progress.open("cookbook building..");
  const { initWatcher } = await import("../watcher");
  await initWatcher(options, mode, false);
  progress.close("");

  // typia transform 全部成功才算构建成功——否则 route-schema 会缺路由，
  // 打包出的 co.exe 内置 mode 服务器没有 /mode/read，下游 astra 全部不可用。
  const { typiaTransformFailures } = await import("../utils/run-typia-transform");
  if (typiaTransformFailures.length > 0) {
    consola.error(
      `typia transform failed for ${typiaTransformFailures.length} file(s):`,
    );
    for (const failure of typiaTransformFailures) {
      consola.error(`  - ${failure.file} (${failure.root})\n    ${failure.error.split("\n")[0]}`);
    }
    exit(1);
  }

  consola.success("Cookbook builded!");
});
