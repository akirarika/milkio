import { reject } from "milkio";
import type { MilkioContext } from "../../../.milkio/declares.ts";

export async function handler(context: MilkioContext, params: {
    a: string;
    b: number;
    throw?: boolean;
}): Promise<{ count: number }> {
    const results = {
        count: 2 + params.b,
    };
    if (params.throw) throw reject("REQUEST_FAIL", "Reject this request");

    return results;
}