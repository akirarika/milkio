import { nodeHandler } from "./node";
import { denoHandler } from "./deno";
import { bunHandler } from "./bun";
import type { CookbookOptions } from "../../../utils/cookbook-dto-types";

export async function generateRunTs(project: CookbookOptions["projects"]["key"], milkioDirPath: string) {
  if (project.runtime === "deno") return await denoHandler(milkioDirPath);
  if (project.runtime === "bun") return await bunHandler(milkioDirPath);
  await nodeHandler(milkioDirPath);
}
