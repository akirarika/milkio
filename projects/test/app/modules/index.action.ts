import type { MilkioContext, MilkioMeta } from "../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

type Params = { a: string; b: number };

type Result = { count: number };

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
    const count = Number(params.a) + params.b;
    context.logger.info("count", count);
    return { count };
}