import type { MilkioMeta, MilkioContext } from "../../../.milkio/declares.ts";
import { cancelState } from "./stream-cancel.stream.ts";

export const meta: MilkioMeta = {};

type Params = {};

type Result = { done: boolean; yieldCount: number };

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
	return { ...cancelState };
}
