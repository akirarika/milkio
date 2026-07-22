import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";
import { createHash } from "node:crypto";

export const meta: MilkioMeta = {};

type Params = { content: string };

type Result = { length: number; md5: string };

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
	return {
		length: params.content.length,
		md5: createHash("md5").update(params.content, "utf-8").digest("hex"),
	};
}
