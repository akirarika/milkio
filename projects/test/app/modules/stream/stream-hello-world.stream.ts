import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

export async function* handler(context: MilkioContext, params: { a: string; b: number; sleep: number }): AsyncGenerator<number> {
    let count = Number(params.a);
    for (let index = 0; index < params.b; index++) {
        if (params.sleep) await new Promise((resolve) => setTimeout(resolve, params.sleep));
        count = count * Number(params.a);
        context.logger.info("count", count);
        yield count;
    }
}