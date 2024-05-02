import type { Context } from "../../../src/context";
import type { FrameworkHttpDetail } from "./context";
import type { MilkioApp } from "milkio";

export type BootstrapMiddleware = (milkio: MilkioApp) => Promise<void> | void;
export type BeforeExecuteMiddleware = (context: Context) => Promise<void> | void;
export type AfterExecuteMiddleware = (context: Context, response: { value: unknown }) => Promise<void> | void;
export type AfterHttpRequestMiddleware = (headers: Headers, detail: FrameworkHttpDetail) => Promise<void> | void;
export type BeforeHttpResponseMiddleware = (response: { value: string }, detail: FrameworkHttpDetail) => Promise<void> | void;
export type HttpNotFoundMiddleware = (detail: FrameworkHttpDetail) => Promise<void> | void;

export type MiddlewareOptions = {
	bootstrap?: BootstrapMiddleware;
	beforeExecute?: BeforeExecuteMiddleware;
	afterExecute?: AfterExecuteMiddleware;
	afterHttpRequest?: AfterHttpRequestMiddleware;
	beforeHttpResponse?: BeforeHttpResponseMiddleware;
	httpNotFound?: HttpNotFoundMiddleware;
} & Record<string, (...args: Array<any>) => Promise<void> | void>;
export type MiddlewareFn = (...args: Array<any>) => Promise<void> | void;
export type MiddlewareT<T extends MiddlewareFn = MiddlewareFn> = { id: string; index: number; middleware: T };

export const _middlewareEvents = new Map<string, (a: MiddlewareT, b: MiddlewareT) => number>();
export const _middlewares = new Map<string, Array<MiddlewareT>>();

export const MiddlewareEvent = (() => {
	const defineMiddlewareEvent = (name: string, sortFn: (a: MiddlewareT, b: MiddlewareT) => number) => {
		_middlewareEvents.set(name, sortFn);
	};

	const sortMiddlewareEvent = () => {
		for (const [key, middleware] of _middlewares) {
			const sort = _middlewareEvents.get(key);
			if (sort) middleware.sort(sort);
		}
	};

	const handleMiddleware = async (name: string, args: Array<any> /* Parameters<MiddlewareOptions[Name]> */) => {
		const mds = _middlewares.get(name);
		if (!mds) return;
		for (const md of mds) {
			await md.middleware(...args);
		}
	};

	return {
		define: defineMiddlewareEvent,
		handle: handleMiddleware,
		_sort: sortMiddlewareEvent,
	};
})();
