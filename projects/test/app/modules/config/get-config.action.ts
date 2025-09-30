import type { MilkioContext } from "../../../.milkio/declares.ts";

export async function handler(context: MilkioContext, params: {}): Promise<typeof context.config> {
    return {
        ...context.config,
    };
}