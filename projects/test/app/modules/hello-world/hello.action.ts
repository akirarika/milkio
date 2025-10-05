// oxlint-disable-next-line no-unused-vars

import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {}

export async function handler(context: MilkioContext, params: {
    a: string;
    b: number;
    throw?: boolean;
}): Promise<{ count: number }> {
    const results = {
        count: 2 + params.b,
        say: "hello world",
    };
    if (params.throw) throw context.reject("REQUEST_FAIL", "Reject this request");
    return results;
}