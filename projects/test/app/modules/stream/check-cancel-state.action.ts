import type { MilkioMeta, MilkioContext } from "../../../.milkio/declares.ts";
import { cancelState } from "./stream-cancel.stream.ts";

export const meta: MilkioMeta = {};

export async function handler(
	context: MilkioContext,
	params: {},
): Promise<{ done: boolean; yieldCount: number }> {
	return { ...cancelState };
}
