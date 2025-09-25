import { type MilkioContext, type MilkioMeta } from "milkio";

export const meta: MilkioMeta = {}

export async function handler(
    context: MilkioContext,
    params: {},
): Promise<{ mode: string }> {
    const mode = context.config.mode;
    return { mode };
}