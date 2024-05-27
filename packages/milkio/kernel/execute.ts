import type { Context } from "../../../src/context";
import { failCode } from "../../../src/fail-code";
import schema from "../../../generated/api-schema";
import { type ExecuteId, type ExecuteOptions, type ExecuteResult, createUlid, useLogger, runtime, loggerPushTags, headerToPlainObject, loggerSubmit, type ExecuteCoreOptions, TSON, MiddlewareEvent, reject, _validate } from "..";
import { handleCatchError } from "../utils/handle-catch-error";

const apis = new Map<string, any>();

/**
 * call is a low-level API that is useful only when you want to execute the Milkio Api without using execute or httpServer.
 * It only does the most basic thing internally, which is calling the API. The external handling of functions such as making executeId, logging, middleware, etc., are all handled externally.
 * Both execute and httpServer essentially call call.
 */
export async function _call(
	mode: "execute" | "stream",
	path: string,
	params: unknown | string,
	headersInit: Record<string, string> | Headers = {},
	options: ExecuteCoreOptions,
): Promise<{ $type: "result"; $result: ExecuteResult<unknown> } | { $type: "stream"; $result: ExecuteResult<unknown>; $generator: AsyncGenerator }> {
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
		} as ExecuteResult<unknown>;

		return { $type: "result", $result: result };
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
		path: path as string,
		headers,
		logger: options.logger,
		detail: options?.detail ?? {},
	};

	let result: { value: unknown };
	try {
		// before execute middleware
		await MiddlewareEvent.handle("beforeExecute", [context]);

		let fn: any;
		// check type
		try {
			// @ts-ignore
			fn = await schema.apiValidator.validate[path]();
		} catch (error) {
			throw reject("BUSINESS_FAIL", "This is the new API, which takes effect after restarting the server or saving any changes. It will be fixed in the future.");
		}
		params = _validate(await fn.validateParams(params));

		// execute api
		let api: any;
		if (apis.has(path as string)) api = apis.get(path as string);
		else {
			// @ts-ignore
			api = schema.apiMethodsSchema[path as string]();
			apis.set(path as string, api);
		}
		const apiModuleAwaited = await api.module;
		const apiMethod = apiModuleAwaited.api.action;
		// @ts-ignore
		result = { value: await apiMethod(params, context) };
		// after execute middleware
		await MiddlewareEvent.handle("afterExecute", [context, result]);

		if (mode === "execute" && !(result.value as AsyncGenerator)[Symbol.asyncIterator]) return { $type: "result", $result: { executeId, success: true, data: result.value } };
		if (mode === "stream" && (result.value as AsyncGenerator)[Symbol.asyncIterator]) return { $type: "stream", $result: { executeId, success: true, data: "$" }, $generator: result.value as AsyncGenerator };
		console.log(mode);

		throw reject("BUSINESS_FAIL", `It looks like you used the wrong syntax, for this API you should use "client.${mode}(...)"`);
	} catch (error: any) {
		const errorResult = handleCatchError(error, executeId);

		return { $type: "result", $result: errorResult };
	}
}

export async function _execute<Path extends keyof (typeof schema)["apiMethodsTypeSchema"], Result extends Awaited<ReturnType<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>>>(
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

	const result = await _call("execute", path, params, headersInit, {
		...options,
		executeId,
		logger,
		onAfterHeaders: (headers) => {
			loggerPushTags(executeId, {
				headers: headerToPlainObject(headers),
			});
		},
	});

	loggerPushTags(executeId, { result: result.$result });
	await loggerSubmit(executeId);
	runtime.execute.executeIds.delete(executeId);

	return result.$result as ExecuteResult<Result>;
}

export async function _executeToJson<Path extends keyof (typeof schema)["apiMethodsTypeSchema"]>(path: Path, params: Parameters<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>[0] | string, headersInit: Record<string, string> | Headers = {}, options?: ExecuteOptions): Promise<string> {
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
