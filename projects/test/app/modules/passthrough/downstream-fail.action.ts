import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

type Params = {};

type Result = {};

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
    throw context.fail("REQUEST_FAIL", "downstream fail");
}
