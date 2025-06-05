import type { CookbookOptions } from "../../utils/cookbook-dto-types";
import { nodeHandler } from "./node";
import { denoHandler } from "./deno";
import { bunHandler } from "./bun";

export async function generateRunTs(project: CookbookOptions["projects"]["key"], paths: { milkio: string }) {
  if (project.runtime === "deno") return await denoHandler(paths);
  if (project.runtime === "bun") return await bunHandler(paths);
  await nodeHandler(paths);
}
