import { nodeHandler } from "./node";
import { denoHandler } from "./deno";
import { bunHandler } from "./bun";
import type { CookbookOptions } from "../../utils/cookbook-dto-types";

export async function generateRunTs(project: CookbookOptions["projects"]["key"], milkioDirPath: string) {
  if (project.runtime === "deno") return await denoHandler(project, milkioDirPath);
  if (project.runtime === "bun") return await bunHandler(project, milkioDirPath);
  await nodeHandler(project, milkioDirPath);
}
