import type { MilkioContext, MilkioMeta } from "../../.milkio/declares";

export const meta: MilkioMeta = {
    onlyVip: true,
}

type Params = {};
type Result = { message: string };

export async function handler(
    context: MilkioContext,
    params: Params,
) {
    const message = `Hello world! UwU`;

    return {
        message
    }
};