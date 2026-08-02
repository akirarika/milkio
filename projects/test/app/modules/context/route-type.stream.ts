import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

type Params = {};

type Result = AsyncGenerator<{ routeType: string }>;

export async function* handler(context: MilkioContext, params: Params): Result {
    yield { routeType: context.routeType };
}
