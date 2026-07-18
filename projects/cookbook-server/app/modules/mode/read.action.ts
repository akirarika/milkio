import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {}

type Params = {};

type Result = { mode: string };

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
    const mode = context.config.mode;
    return { mode };
}