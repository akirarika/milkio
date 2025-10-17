import type { MilkioContext, MilkioMeta } from "../../.milkio/declares";

export const meta: MilkioMeta = {
    onlyVip: true,
}

export async function handler(
    context: MilkioContext,
    params: {},
) {
    const message = `Hello world! UwU`;

    return {
        message
    }
};