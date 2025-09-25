import { type MilkioContext } from "milkio";

export async function handler(context: MilkioContext, params: {}): Promise<typeof context.config> {
    return {
        ...context.config,
    };
}