// oxlint-disable-next-line no-unused-vars

import type { MilkioContext } from "../../../.milkio/declares.ts";

export async function handler(context: MilkioContext, params: {
    a: string;
    b: number;
    throw?: boolean;
}): Promise<{ count: number }> {
    const results = {
        count: 2 + params.b,
    };
    if (params.throw) throw context.reject("REQUEST_FAIL", "Reject this request");

    return results;
}