import { TSON } from "@southern-aurora/tson";
import { EventSourceMessage, getBytes, getLines, getMessages } from './parse.ts';

export type MilkioClientOptions = {
	baseUrl: string | (() => string) | (() => Promise<string>);
	logs?: boolean;
	timeout?: number;
	middlewares?: () => Array<MiddlewareOptions & { isMiddleware: true }>;
	fetch?: typeof fetch;
	abort?: typeof AbortController;
	storage?: {
		getItem: (key: string) => string | null | Promise<string | null>;
		setItem: (key: string, value: string) => void | Promise<void>;
		removeItem: (key: string) => void | Promise<void>;
	};
};

export const defineMilkioClient = <ApiSchema extends ApiSchemaExtend, FailCode extends FailCodeExtend>(builtinMiddlewares: Array<MiddlewareOptions & { isMiddleware: true }>) => {
	return (options: MilkioClientOptions) => {
		const $fetch = options.fetch ?? fetch;
		const $abort = options.abort ?? AbortController;
		const _bootstrapMiddlewares: Array<{
			id: string;
			index: number;
			middleware: BootstrapMiddleware;
		}> = [];
		const _beforeExecuteMiddlewares: Array<{
			id: string;
			index: number;
			middleware: BeforeExecuteMiddleware;
		}> = [];
		const _afterExecuteMiddlewares: Array<{
			id: string;
			index: number;
			middleware: AfterExecuteMiddleware;
		}> = [];

		if (!options.storage) {
			options.storage = localStorage;
		}

		const bootstrap = async () => {
			let baseUrl = options.baseUrl;
			if (typeof baseUrl === "function") baseUrl = await baseUrl();
			if (!baseUrl.endsWith("/")) baseUrl = `${baseUrl}/`;

			if (options.middlewares) {
				const middlewares = [...builtinMiddlewares, ...options.middlewares()];

				const push = (index: number, middlewares: Array<any>, middleware: any) => {
					const id = ++guid;
					middlewares.push({ id, index, middleware });
					return () =>
						middlewares.splice(
							middlewares.findIndex((v) => v.id === id),
							1,
						);
				};

				const _middlewareHanlder = (index: number, options: MiddlewareOptions) => {
					if (options.bootstrap) push(index, _bootstrapMiddlewares, options.bootstrap);
					if (options.beforeExecute) push(index, _beforeExecuteMiddlewares, options.beforeExecute);
					if (options.afterExecute) push(index, _afterExecuteMiddlewares, options.afterExecute);
				};

				for (let index = 0; index < middlewares.length; index++) {
					const middlewareOptions = middlewares[index];
					_middlewareHanlder(index, middlewareOptions);
				}

				_bootstrapMiddlewares.sort((a, b) => a.index - b.index);
				_beforeExecuteMiddlewares.sort((a, b) => a.index - b.index);
				_afterExecuteMiddlewares.sort((a, b) => b.index - a.index);

				for (const m of _bootstrapMiddlewares) {
					await m.middleware({ storage: options.storage as ClientStorage });
				}
			}

			return baseUrl;
		};

		const baseUrl: Promise<string> = bootstrap();

		const client = {
			async execute<Path extends keyof ApiSchema["apiMethodsTypeSchema"], Params extends ExecuteParams<Path>>(path: Path, params: Params, headers?: Record<string, string>, executeOptions?: ExecuteOptions): Promise<ExecuteResult<Path>> {
				if (headers === undefined) headers = {};
				const url = (await baseUrl) + (path as string);

				if (headers["Accept"] === undefined) headers["Accept"] = "application/json";
				if (headers["Content-Type"] === undefined) headers["Content-Type"] = "application/json";

				try {
					for (const m of _beforeExecuteMiddlewares) {
						await m.middleware({ path: path as string, params, headers, storage: options.storage as ClientStorage });
					}

					const body = TSON.stringify(params) ?? "";
					const response = await new Promise<string>(async (resolve, reject) => {
						const timeout = executeOptions?.timeout ?? options?.timeout ?? 6000;
						const timer = setTimeout(() => {
							reject(defineClientFail("execute-timeout", `Execute timeout after ${timeout}ms.`));
						}, timeout);

						try {
							const value = await (await $fetch(url, { method: "POST", body, headers })).text();
							clearTimeout(timer);
							resolve(value);
						} catch (error) {
							reject(error);
						}
					});
					const result = { value: TSON.parse(response) };

					for (const m of _afterExecuteMiddlewares) {
						await m.middleware({ path: path as string, storage: options.storage as ClientStorage, result });
					}

					if (options.logs !== false) console.log("[EXECUTE] Success:", path, result.value);

					return result.value;
				} catch (error: any) {
					if (error?.fail?.code === "client-fail") {
						if (options.logs !== false) console.log("[EXECUTE] Fail:", path, error);
						return error;
					}
					throw error;
				}
			},

			// This part of the code is based on `@microsoft/fetch-event-source` rewrite, thanks to the work of Microsoft
			// https://github.com/Azure/fetch-event-source
			executeStream<Path extends keyof ApiSchema["apiMethodsTypeSchema"], Params extends ExecuteParams<Path>>(
				path: Path,
				eventOptions: {
					params: Params;
					headers?: Record<string, string>;
					onError?: (event: any) => any;
				},
			): AsyncGenerator<ExecuteResultStreamChunk<MilkioEvent<Path>>> {
				if (eventOptions.headers === undefined) eventOptions.headers = {};
				if (eventOptions.headers['Accept'] === undefined) eventOptions.headers['Accept'] = 'text/event-stream';
				if (eventOptions.headers["Content-Type"] === undefined) eventOptions.headers["Content-Type"] = "application/json";
				const url = async () => (await baseUrl) + (path as string) + (`?params=${encodeURIComponent(TSON.stringify(eventOptions.params))}`);
				const body = TSON.stringify(eventOptions.params) ?? "";

				let resolvers: {
					promise: Promise<IteratorResult<ExecuteResultStreamChunk>>;
					resolve: (value: IteratorResult<ExecuteResultStreamChunk>) => void;
					reject: (reason: any) => void;
				} | undefined;

				const onmessage = (event: EventSourceMessage) => {
					if (resolvers) resolvers.resolve({ done: false, value: { type: 'data', data: TSON.parse(event.data) } });
				}

				// make a copy of the input headers since we may modify it below:
				const headers = { ...eventOptions.headers };

				let curRequestController: AbortController;

				async function create() {
					curRequestController = new $abort();
					curRequestController.signal.addEventListener('abort', () => {
						if (resolvers) resolvers.resolve({ done: true, value: { type: 'close' } }); // don't waste time constructing/logging errors
					});
					try {
						for (const m of _beforeExecuteMiddlewares) {
							await m.middleware({ path: path as string, params: eventOptions.params, headers: eventOptions.headers!, storage: options.storage as ClientStorage });
						}
						const response = await $fetch(await url(), {
							method: 'POST',
							headers,
							body: body,
							signal: curRequestController.signal,
						});

						const contentType = response.headers.get('Content-Type');
						if (!contentType?.startsWith('text/event-stream')) {
							throw new Error(`Expected content-type to be ${'text/event-stream'}, Actual: ${contentType}`);
						}

						await getBytes(response.body!, getLines(getMessages(onmessage)));
						await iterator.return();
					} catch (err) {
						try {
							curRequestController.abort();
						} catch (error) { }
						if (resolvers) resolvers.resolve({ done: true, value: { type: 'error', error: err } });
						await iterator.throw(err);
					}
				}

				void create();

				const iterator = {
					...{
						next(): Promise<IteratorResult<unknown>> {
							resolvers = Promise.withResolvers();
							return resolvers.promise;
						},
						async return(): Promise<IteratorResult<void>> {
							try {
								curRequestController.abort();
							} catch (error) { }
							if (resolvers) resolvers.resolve({ done: true, value: { type: 'close' } });
							return { done: true, value: undefined }
						},
						async throw(err: any): Promise<IteratorResult<void>> {
							try {
								curRequestController.abort();
							} catch (error) { }
							if (resolvers) {
								resolvers.resolve({ done: false, value: { type: 'error', error: err } });
								await resolvers.promise;
							}
							return { done: true, value: undefined }
						}
					} satisfies AsyncIterator<unknown>,
					[Symbol.asyncIterator]() {
						return this;
					},
				};

				return iterator as any;
			},
		};

		type ExecuteParams<Path extends keyof ApiSchema["apiMethodsSchema"]> = Awaited<Parameters<ApiSchema["apiMethodsTypeSchema"][Path]["api"]["action"]>[0]>;
		type ExecuteResult<Path extends keyof ApiSchema["apiMethodsTypeSchema"]> =
			| {
				success: true;
				data: Awaited<ReturnType<ApiSchema["apiMethodsTypeSchema"][Path]["api"]["action"]>>;
			}
			| {
				success: false;
				fail: {
					code: FailCode;
					message: string;
					data: Parameters<FailCode[keyof FailCode]>[0];
				};
			}
			| {
				success: false;
				fail: {
					fromClient: true;
					code: string;
					message: string;
					data: any;
				};
			};
		type MilkioEventResult<Path extends keyof ApiSchema["apiMethodsTypeSchema"]> = Awaited<ReturnType<ApiSchema["apiMethodsTypeSchema"][Path]["api"]["action"]>>;
		type MilkioEvent<Path extends keyof ApiSchema["apiMethodsTypeSchema"]> = Awaited<GeneratorGeneric<MilkioEventResult<Path>>>;

		return client;
	};
};

export function defineMiddleware(options: MiddlewareOptions): () => MiddlewareOptions & { isMiddleware: true } {
	return () => ({
		...options,
		isMiddleware: true,
	});
}

export const defineClientFail = (code: string, message: string, data?: unknown) => ({
	success: false,
	fail: {
		fromClient: true,
		code,
		message,
		data,
	},
});

let guid = 0;

export type ExecuteOptions = {
	timeout?: number;
};

export type ApiSchemaExtend = {
	apiValidator: {
		generatedAt: number;
		validate: Record<any, any>;
	};
	apiMethodsSchema: Record<any, any>;
	apiMethodsTypeSchema: Record<any, any>;
	apiTestsSchema: Record<any, any>;
};

export type FailCodeExtend = Record<any, (...args: Array<any>) => any>;

type BootstrapMiddleware = (data: { storage: ClientStorage }) => Promise<void> | void;
export type BeforeExecuteMiddleware = (data: { path: string; params: any; headers: Record<string, string>; storage: ClientStorage }) => Promise<void> | void;
export type AfterExecuteMiddleware = (data: { path: string; result: { value: any }; storage: ClientStorage }) => Promise<void> | void;

export type MiddlewareOptions = {
	bootstrap?: BootstrapMiddleware;
	beforeExecute?: BeforeExecuteMiddleware;
	afterExecute?: AfterExecuteMiddleware;
};

export type ClientStorage = {
	getItem: (key: string) => Promise<string | null>;
	setItem: (key: string, value: string) => Promise<void>;
	removeItem: (key: string) => Promise<void>;
};

export type ExecuteResultSuccess<Result> = {
	executeId: string;
	success: true;
	data: Result;
};

export type GeneratorGeneric<T> = T extends AsyncGenerator<infer I> ? I : never;

export type ExecuteResultStreamChunk<Result = any> = { type: 'data', data: Result } | { type: 'error', error: any };