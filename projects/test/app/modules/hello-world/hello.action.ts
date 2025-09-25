import { reject, type MilkioMeta, type MilkioContext } from "milkio";

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
    if (params.throw) throw reject("FAIL", "Reject this request");
    return results;
}