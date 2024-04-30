import type { Meta } from "../../../src/meta";
import schema from "../../../generated/api-schema";

export async function useMeta(path: string): Promise<Meta> {
	// @ts-ignore
	const api = schema.apiMethodsSchema[path as keyof (typeof schema)["apiMethodsTypeSchema"]]();
	const module = await api.module;
	return module.api.meta;
}
