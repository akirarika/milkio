import type { MilkioContext } from "../../../.milkio/declares.ts";

type Params = {};

type Result = { [key: string]: any };

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
    return {
        ...context.config,
    };
}