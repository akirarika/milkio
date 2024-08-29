import { join } from "node:path";
import { consola } from "consola";
import type { BunFile } from "bun";
import typia, { tags } from "typia";
import { exit, cwd } from "node:process";
import { TSON } from "@southern-aurora/tson";
import type { MilkioOptions } from "../..";
import type { MilkioActionParams } from "../../actions";

export const getOptions = async (milkioToml: BunFile) => {
  if (!(await milkioToml.exists())) {
    consola.error(`The "milkio.toml" file does not exist in the current directory: ${join(cwd())}`);
    exit(0);
  }

  const options = Bun.TOML.parse(await milkioToml.text());

  const checkResult = typia.validate<MilkioOptions>(options);
  if (!checkResult.success) {
    const error = checkResult.errors.at(0)!;
    consola.error(`"Milkio.toml" format is incorrect, [${error.path.slice(7)}] should be ${error.expected}, but it is actually ${error.value}`);
    exit(0);
  }
  return options as any;
};

export const getActionOptions = (options: string) => {
  const checkResult = typia.misc.validatePrune<MilkioOptions>(TSON.parse(options));
  if (!checkResult.success) {
    throw checkResult.errors.at(0)!;
  }
  return options;
};
