import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

export async function handler(
	context: MilkioContext,
	params: { date: Date },
): Promise<{ isDate: boolean; timestamp: number; iso: string }> {
	const d = params.date;
	return {
		isDate: d instanceof Date,
		timestamp: d instanceof Date ? d.getTime() : -1,
		iso: d instanceof Date ? d.toISOString() : String(d),
	};
}
