/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

import { TSON } from "@southern-aurora/tson";

export type MilkioClientOptions = {
	baseUrl: string | (() => string) | (() => Promise<string>);
	logs?: boolean;
	timeout?: number;
	middlewares?: () => Array<MiddlewareOptions & { isMiddleware: true }>;
	handler: (url: string, body: string, headers: Record<string, string>) => Promise<string>;
	storage: {
		getItem: (key: string) => string | null | Promise<string | null>;
		setItem: (key: string, value: string) => void | Promise<void>;
		removeItem: (key: string) => void | Promise<void>;
	};
};

export const defineMilkioClient = <ApiSchema extends ApiSchemaExtend, FailCode extends FailCodeExtend>(builtinMiddlewares: Array<MiddlewareOptions & { isMiddleware: true }>) => {
	return (options: MilkioClientOptions) => {
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
					await m.middleware();
				}
			}

			return baseUrl;
		};

		const baseUrl: Promise<string> = bootstrap();

		const client = {
			async execute<Path extends keyof ApiSchema["apiMethodsTypeSchema"], Params extends ExecuteParams<Path>>(path: Path, params: Params, headers?: Record<string, string>, executeOptions?: ExecuteOptions): Promise<ExecuteResult<Path>> {
				if (headers === undefined) headers = {};
				const url = (await baseUrl) + (path as string);

				try {
					for (const m of _beforeExecuteMiddlewares) {
						await m.middleware({ path: path as string, params, headers, storage: options.storage as ClientStorage });
					}

					const body = TSON.stringify(params) ?? "";
					const response = await new Promise<string>((resolve, reject) => {
						const timeout = executeOptions?.timeout ?? options?.timeout ?? 6000;
						const timer = setTimeout(() => {
							reject(defineClientFail("execute-timeout", `Execute timeout after ${timeout}ms.`));
						}, timeout);
						options
							.handler(url as string, body, headers!)
							.then((value) => {
								clearTimeout(timer);
								resolve(value);
							})
							.catch((reason) => {
								reject(reason);
							});
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

type BootstrapMiddleware = () => Promise<void> | void;
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
