import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";
import { stargate } from "../../utils/stargate.ts";

export const meta: MilkioMeta = {};

type Params = {};

type Result = {};

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
    const [failure] = await stargate.execute("/passthrough/downstream-fault", { params: {} });
    if (failure) throw failure;
    return {};
}
