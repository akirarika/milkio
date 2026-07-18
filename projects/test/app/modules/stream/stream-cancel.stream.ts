import type { MilkioMeta, MilkioContext } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

export let cancelState: { done: boolean; yieldCount: number } = { done: true, yieldCount: 0 };

type Params = {};

type Result = AsyncGenerator<{ value: number }>;

export async function* handler(context: MilkioContext, params: Params): Result {
	cancelState = { done: false, yieldCount: 0 };
	try {
		for (let i = 0; i < 50; i++) {
			await new Promise((resolve) => setTimeout(resolve, 50));
			cancelState.yieldCount = i + 1;
			yield { value: i };
		}
	} finally {
		cancelState.done = true;
	}
}
