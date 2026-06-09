import type { MilkioContext } from "../../../.milkio/declares.ts";

export async function handler(
	context: MilkioContext,
	params: { a: number; b: number },
): Promise<{ result: number }> {
	return { result: params.a + params.b };
}
