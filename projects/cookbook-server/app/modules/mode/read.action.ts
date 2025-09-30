import { type $context, type $meta } from "milkio";

export const meta: $meta = {}

export async function handler(
    context: $context,
    params: {},
): Promise<{ mode: string }> {
    const mode = context.config.mode;
    return { mode };
}