import type { CookbookActionParams } from "../utils/cookbook-dto-types";
import { pingActions } from "./ping";
import { loggerActions } from "./logger";
import { templateActions } from "./template";
import { projectActions } from "./project";
import { join } from "node:path";
import { cwd } from "node:process";

const actions = [...pingActions, ...loggerActions, ...templateActions, ...projectActions];

export async function actionHandler(params: CookbookActionParams) {
  if (!params || !params.type) throw "Invalid cookbook command, please upgrade the version of cookbook.";
  const options: any = await Bun.TOML.parse(await Bun.file(join(cwd(), "cookbook.toml")).text());
  for (const action of actions) {
    const result = await action(options, params);
    if (result === false) continue;
    return result;
  }
  throw "Unknown cookbook command, please upgrade the version of cookbook.";
}
