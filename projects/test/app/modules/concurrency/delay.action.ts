import type { MilkioContext } from "../../../.milkio/declares.ts";

type Params = {
  delayMs: number
}

type Result = {
  startedAt: number
  completedAt: number
  delayMs: number
}

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
  const startedAt = Date.now();
  await new Promise((resolve) => setTimeout(resolve, params.delayMs));
  const completedAt = Date.now();
  return { startedAt, completedAt, delayMs: params.delayMs };
}