import { type MilkioContext, type MilkioMeta } from "milkio";

export const meta: MilkioMeta = {};

export async function handler(context: MilkioContext, params: { a: string; b: number }): Promise<{ count: number }> {
    const count = Number(params.a) + params.b;
    context.logger.info("count", count);
    return { count };
}