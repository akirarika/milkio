import type { MilkioContext } from "../../../.milkio/declares.ts";

type Params = { a: number; b: number };

type Result = { result: number };

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
	return { result: params.a + params.b };
}
