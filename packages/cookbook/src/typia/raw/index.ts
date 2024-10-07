import { join } from "node:path";
import { consola } from "consola";
import type { BunFile } from "bun";
import typia from "typia";
import { exit, cwd } from "node:process";
import { TSON } from "@southern-aurora/tson";
import type { CookbookOptions } from "../..";
import type { MilkioActionParams } from "../../actions";

export const getOptions = async (milkioToml: BunFile) => {
  if (!(await milkioToml.exists())) {
    consola.error(`The "cookbook.toml" file does not exist in the current directory: ${join(cwd())}`);
    exit(0);
  }

  const options = Bun.TOML.parse(await milkioToml.text());

  const checkResult = typia.validateEquals<CookbookOptions>(options);
  if (!checkResult.success) {
    const error = checkResult.errors.at(0)!;
    consola.error(
      `The "cookbook.toml" format is incorrect, [${error.path.slice(7)}] should be ${error.expected}, but it is actually ${error.value}. You may be missing some properties in the configuration item, or adding some properties that will not be used. If you have extra properties, these properties are likely due to a misspelling.`,
    );
    exit(0);
  }
  return options as any;
};

export const getActionOptions = (options: string): any => {
  const results = TSON.parse(options);
  const checkResult = typia.misc.validatePrune<MilkioActionParams>(results);
  if (!checkResult.success) {
    throw checkResult.errors.at(0)!;
  }
  return results;
};
