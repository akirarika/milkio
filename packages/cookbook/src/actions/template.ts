import { $ } from "bun";
import type { CookbookActionParams, CookbookOptions } from "../utils/cookbook-dto-types.ts";

export async function template(options: CookbookOptions, params: CookbookActionParams) {
  if (params.type !== "milkio@template") return false;
  await $`bun run .templates/${params.template}.template.ts ${params.name} ${params.fsPath}`;
}

export const templateActions = [template];
