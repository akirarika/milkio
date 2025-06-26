import type { CookbookActionParams, CookbookOptions } from "../utils/cookbook-dto-types.ts";

async function ping(options: CookbookOptions, params: CookbookActionParams) {
  if (params.type !== "milkio@ping") return false;
  return "pong";
}

export const pingActions = [ping];
