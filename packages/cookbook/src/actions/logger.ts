import type { CookbookActionParams, CookbookOptions } from "../utils/cookbook-dto-types.ts";
import { emitter } from "../emitter/index.ts";

async function logger(options: CookbookOptions, params: CookbookActionParams) {
  if (params.type !== "milkio@logger") return false;
  emitter.emit("data", {
    type: "milkio@logger",
    log: params.log,
  });
}

export const loggerActions = [logger];
