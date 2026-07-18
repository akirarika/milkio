import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

type Params = { a: string; b: number; sleep: number };

type Result = AsyncGenerator<{ value: number }>;

export async function* handler(context: MilkioContext, params: Params): Result {
    let count = Number(params.a);
    for (let index = 0; index < params.b; index++) {
        if (params.sleep) await new Promise((resolve) => setTimeout(resolve, params.sleep));
        count = count * Number(params.a);
        context.logger.info("count", count);
        yield { value: count };
    }
}