/* eslint-disable no-console, @typescript-eslint/no-invalid-void-type, @typescript-eslint/await-thenable, @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any */
import { type MiddlewareOptions, _middlewares, MiddlewareEvent } from "./middleware";
import schema from "../../../generated/api-schema";
import type { Context } from "../../../src/context";
import { failCode } from "../../../src/fail-code";
import type { MilkioContext } from "./context";
import { headerToPlainObject } from "../utils/header-to-plain-object";
import { type Mixin, type ExecuteId, type Fail, type FailEnumerates, loggerPushTags, loggerSubmit, runtime, TSON, type Logger, useLogger, reject } from "..";
import { hanldeCatchError } from "../utils/handle-catch-error";
import { createUlid } from "../utils/create-ulid";
import { _validate } from "./validate";
import { exit } from "node:process";

export type MilkioAppOptions = {
	/**
	 * bootstraps
	 * @description
	 * When Milkio is launched, all methods in this array will run **in parallel**.
	 */
	bootstraps?: () => Array<
		/* This type is long, and its intention is to prevent someone from forgetting to add parentheses when adding bootstraps. Therefore, it allows all types except methods */ Promise<unknown> | void | string | number | boolean | null | undefined | Record<string | number | symbol, unknown> | Array<unknown>
	>;
	/**
	 * middlewares
	 * @description
	 * When Milkio is launched, the closer it is to the front of the array, the more it is on the outer layer of the "onion".
	 */
	middlewares?: () => Array<MiddlewareOptions>;
	/**
	 * maxRunningTime (minutes)
	 * @description
	 * When the function runs for a long time, it is possible that the memory will continuously expand (not necessarily due to memory leaks, but also possibly due to having a large number of routes).
	 * Set the maximum running time (in minutes). When milkio's running time reaches this value, terminate the process and automatically restart it from outside (K8S or other means).
	 */
	enableMaxRunningTimeoutLimit?: number | null | undefined;
};

export async function createMilkioApp(MilkioAppOptions: MilkioAppOptions = {}) {
	if (MilkioAppOptions.enableMaxRunningTimeoutLimit && MilkioAppOptions.enableMaxRunningTimeoutLimit >= 1) {
		setTimeout(
			() => {
				throw new Error('Milkio reached the limit of "maxRunningTimeout" in the options and automatically exited.');
			},
			MilkioAppOptions.enableMaxRunningTimeoutLimit * 60 * 1000,
		);
		runtime.maxRunningTimeout.enable = true;
	}

	const MilkioApp = {
		execute: _execute,
		executeToJson: _executeToJson,
		_executeCore,
		_executeCoreToJson,
		randParams: _randParams,
	};

	if (MilkioAppOptions.bootstraps) {
		await Promise.all(MilkioAppOptions.bootstraps());
	}

	if (MilkioAppOptions.middlewares) {
		MiddlewareEvent.define("bootstrap", (a, b) => a.index - b.index);
		MiddlewareEvent.define("beforeExecute", (a, b) => a.index - b.index);
		MiddlewareEvent.define("afterExecute", (a, b) => b.index - a.index);
		MiddlewareEvent.define("afterHTTPRequest", (a, b) => a.index - b.index);
		MiddlewareEvent.define("beforeHTTPResponse", (a, b) => b.index - a.index);

		const middlewares = MilkioAppOptions.middlewares();

		for (let index = 0; index < middlewares.length; index++) {
			const middlewareOptions = middlewares[index];
			for (const name in middlewareOptions) {
				let middleware = _middlewares.get(name);
				if (middleware === undefined) {
					middleware = [];
					_middlewares.set(name, middleware);
				}
				const id = createUlid();
				middleware.push({ id, index, middleware: middlewareOptions[name] });
			}
		}
		MiddlewareEvent._sort();

		await MiddlewareEvent.handle("bootstrap", [MilkioApp]);
	}

	return MilkioApp;
}

async function _execute<Path extends keyof (typeof schema)["apiMethodsTypeSchema"], Result extends Awaited<ReturnType<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>>>(
	path: Path,
	params: Parameters<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>[0] | string,
	headersInit: Record<string, string> | Headers = {},
	options?: ExecuteOptions,
): Promise<ExecuteResult<Result>> {
	const executeId = (options?.executeId ?? createUlid()) as ExecuteId;
	const logger = useLogger(executeId);
	runtime.execute.executeIds.add(executeId);

	loggerPushTags(executeId, {
		from: "execute",
		executeId,
		params,
		path,
	});

	const result: any = await _executeCore(path, params, headersInit, {
		...options,
		executeId,
		logger,
		onAfterHeaders: (headers) => {
			loggerPushTags(executeId, {
				headers: headerToPlainObject(headers),
			});
		},
	});

	loggerPushTags(executeId, { result });
	await loggerSubmit(executeId);
	runtime.execute.executeIds.delete(executeId);

	return result;
}

/**
 * executeCore is a low-level API that is useful only when you want to execute the Milkio Api without using execute or httpServer.
 * It only does the most basic thing internally, which is calling the API. The external handling of functions such as making executeId, logging, middleware, etc., are all handled externally.
 * Both execute and httpServer essentially call executeCore.
 */
async function _executeCore<Path extends keyof (typeof schema)["apiMethodsTypeSchema"], Result extends Awaited<ReturnType<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>>>(
	path: Path,
	params: Parameters<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>[0] | string,
	headersInit: Record<string, string> | Headers = {},
	options: ExecuteCoreOptions,
): Promise<ExecuteResult<Result>> {
	const executeId = options.executeId as ExecuteId;

	params = TSON.decode(params);

	if (!(path in schema.apiMethodsSchema)) {
		const result = {
			executeId,
			success: false,
			fail: {
				code: "NOT_FOUND",
				message: failCode.NOT_FOUND(),
				data: undefined,
			},
		} satisfies ExecuteResult<Result>;

		return result;
	}

	let headers: Headers;
	if (!(headersInit instanceof Headers)) {
		// @ts-ignore
		headers = new Headers({
			...headersInit,
		});
	} else {
		headers = headersInit;
	}

	if (options?.onAfterHeaders) {
		await options.onAfterHeaders(headers);
	}

	const context: Context = {
		executeId,
		path,
		headers,
		logger: options.logger,
		detail: options?.detail ?? {},
	};

	let result: { value: Result };
	try {
		// before execute middleware
		await MiddlewareEvent.handle("beforeExecute", [context]);

		let fn: any;
		// check type
		// @ts-ignore
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		try {
			fn = await schema.apiValidator.validate[path]();
		} catch (error) {
			throw reject("BUSINESS_FAIL", "This is the new API, which takes effect after restarting the server or saving any changes. It will be fixed in the future.");
		}

		params = _validate(await fn.validateParams(params));

		// execute api
		let api: any;
		if (apis.has(path)) api = apis.get(path);
		else {
			// @ts-ignore
			api = schema.apiMethodsSchema[path]();
			apis.set(path, api);
		}
		const apiModuleAwaited = await api.module;

		const apiMethod = apiModuleAwaited.api.action;

		// @ts-ignore
		result = { value: await apiMethod(params, context) };

		// after execute middleware
		await MiddlewareEvent.handle("afterExecute", [context, result]);
	} catch (error: any) {
		const errorResult = hanldeCatchError(error, executeId);

		return errorResult;
	}

	return {
		executeId,
		success: true,
		data: result.value,
	};
}

async function _executeToJson<Path extends keyof (typeof schema)["apiMethodsTypeSchema"]>(path: Path, params: Parameters<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>[0] | string, headersInit: Record<string, string> | Headers = {}, options?: ExecuteOptions): Promise<string> {
	const resultsRaw = await _execute(path, params, headersInit, options);
	let fn: any;
	try {
		fn = await schema.apiValidator.validate[path]();
	} catch (error) {
		throw reject("BUSINESS_FAIL", "This is the new API, which takes effect after restarting the server or saving any changes. It will be fixed in the future.");
	}
	const results = await fn.validateResults(TSON.encode(resultsRaw));
	return results;
}

async function _executeCoreToJson<Path extends keyof (typeof schema)["apiMethodsTypeSchema"]>(path: Path, params: Parameters<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>[0] | string, headersInit: Record<string, string> | Headers = {}, options: ExecuteCoreOptions): Promise<string> {
	const resultsRaw = await _executeCore(path, params, headersInit, options);
	let fn: any;
	try {
		fn = await schema.apiValidator.validate[path]();
	} catch (error) {
		throw reject("BUSINESS_FAIL", "This is the new API, which takes effect after restarting the server or saving any changes. It will be fixed in the future.");
	}
	const results = await fn.validateResults(TSON.encode(resultsRaw));
	return results;
}

export async function _randParams<Path extends keyof (typeof schema)["apiMethodsTypeSchema"]>(path: Path): Promise<Parameters<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>[0]> {
	return await (await schema.apiValidator.validate[path]()).randParams();
}

const apis = new Map<string, any>();

export type ExecuteResult<Result> = ExecuteResultSuccess<Result> | ExecuteResultFail;

export type ExecuteResultSuccess<Result> = {
	executeId: ExecuteId;
	success: true;
	data: Result;
};

export type ExecuteResultFail<FailT extends Fail<keyof FailEnumerates> = Fail<keyof FailEnumerates>> = {
	executeId: ExecuteId;
	success: false;
	fail: FailT;
};

export type ExecuteOptions = {
	/**
	 * The executeId of the request
	 * executeId may be generated by the serverless provider, if not, a random string will be generated instead
	 */
	executeId?: string;
	/**
	 * Additional information about the request
	 * These are usually only fully implemented when called by an HTTP server
	 * During testing or when calling between microservices, some or all of the values may be undefined
	 */
	detail?: MilkioContext["detail"];
};

export type ExecuteCoreOptions = Mixin<
	ExecuteOptions,
	{
		executeId: string;
		logger: Logger;
		onAfterHeaders?: (headers: Headers) => void | Promise<void>;
	}
>;
