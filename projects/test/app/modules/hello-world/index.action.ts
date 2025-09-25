import { reject, type MilkioContext, type MilkioMeta } from "milkio";

export const meta: MilkioMeta = {};

export async function handler(context: MilkioContext, params: {
    a: string;
    b: number;
    throw?: boolean;
}): Promise<{ count: number }> {
    const results = {
        count: 2 + params.b,
    };
    if (params.throw) throw reject("FAIL", "Reject this request");

    return results;
}