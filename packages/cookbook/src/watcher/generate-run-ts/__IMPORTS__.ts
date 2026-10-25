import { nodeHandler } from "./node";
import { bunHandler } from "./bun";
import type { CookbookOptions } from "../../utils/cookbook-dto-types";

export async function generateRunTs(project: CookbookOptions["projects"]["key"], milkioDirPath: string) {
  if (project.runtime === "bun") return await bunHandler(project, milkioDirPath);
  await nodeHandler(project, milkioDirPath);
}
