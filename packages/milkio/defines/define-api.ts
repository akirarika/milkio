import type { Meta } from "../../../src/meta";
import type { Context } from "../../../src/context";

export function defineApi<ApiT extends Api>(api: ApiT): ApiT & { isApi: true } {
	return { ...api, isApi: true };
}

export type Api<ActionT = unknown> = {
	meta: Meta;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	action: (params: any, context: Context) => Promise<unknown> | unknown;
};
