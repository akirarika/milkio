import type { MilkioContext } from "../../../.milkio/declares.ts";

type Params = {
    a: number
    b: number
}

type Result = {
    sum: number
    product: number
}

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
    const result = await context.call(import('./$exports/helper.action.ts'), {
        a: params.a,
        b: params.b,
    });

    return {
        sum: result.sum,
        product: result.product,
    };
}