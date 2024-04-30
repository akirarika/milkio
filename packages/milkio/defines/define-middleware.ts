import type { MiddlewareOptions } from "..";

export function defineMiddleware(options: MiddlewareOptions): () => MiddlewareOptions {
	return () => ({
		...options,
		// @ts-ignore
		isMiddleware: true,
	});
}
