import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

type Params = { date: Date };

type Result = { isDate: boolean; timestamp: number; iso: string };

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
    const d = params.date;
    return {
        isDate: d instanceof Date,
        timestamp: d instanceof Date ? d.getTime() : -1,
        iso: d instanceof Date ? d.toISOString() : String(d),
    };
}
