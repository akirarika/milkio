import { loggerPushTags, loggerSubmit, useLogger, runtime, MiddlewareEvent, reject } from "..";
import type { ExecuteId, MilkioApp, Mixin } from "..";
import { handleCatchError } from "../utils/handle-catch-error";
import { routerHandler } from "../../../src/router";
import schema from "../../../generated/api-schema";
import { failCode } from "../../../src/fail-code";
import { TSON } from "@southern-aurora/tson";
import { createUlid } from "../utils/create-ulid";
import { configMilkio } from "../../../src/config/milkio";
import { headerToPlainObject } from "../utils/header-to-plain-object";

export type ExecuteHttpServerOptions = {
	/**
	 * The execution ID generator
	 * If you have enabled this option, the executeId will be generated each time by calling this method. Otherwise, it will be generated using the built-in method.
	 *
	 * @param request
	 * @returns
	 */
	executeIdGenerator?: (request: Request) => string | Promise<string>;
	getRealIp?: (request: Request) => string;
};

export function defineHttpHandler(app: MilkioApp, options: ExecuteHttpServerOptions = {}) {
	const fetch = async (request: MilkioHttpRequest) => {
		const fullurl = new URL(request.request.url, `http://${request.request.headers.get("host") ?? "localhost"}`);
		const executeId = (options?.executeIdGenerator ? await options.executeIdGenerator(request.request) : createUlid()) as ExecuteId;
		runtime.execute.executeIds.add(executeId);
		const logger = useLogger(executeId);
		const ip = options.getRealIp ? options.getRealIp(request.request) : (request.request.headers.get("X-Forwarded-For") as string | undefined)?.split(",")[0] ?? "0.0.0.0";
		const headers = request.request.headers;

		loggerPushTags(executeId, {
			from: "http-server",
			fullUrl: fullurl.pathname,
			ip,
			method: request.request.method,
			// @ts-ignore
			requestHeaders: headerToPlainObject(request.request.headers),
			timein: new Date().getTime(),
		});

		const response: MilkioHttpResponse = {
			body: "",
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Methods": configMilkio.corsAllowMethods ?? "*",
				"Access-Control-Allow-Headers": configMilkio.corsAllowHeaders ?? "*",
				"Access-Control-Allow-Origin": configMilkio.corsAllowOrigin ?? "*",
			},
		};

		try {
			// Process OPTIONS pre inspection requests
			if (request.request.method === "OPTIONS") {
				await loggerSubmit(executeId);
				runtime.execute.executeIds.delete(executeId);

				return new Response("", {
					headers: {
						"Access-Control-Allow-Methods": configMilkio.corsAllowMethods ?? "*",
						"Access-Control-Allow-Headers": configMilkio.corsAllowHeaders ?? "*",
						"Access-Control-Allow-Origin": configMilkio.corsAllowOrigin ?? "*",
					},
				});
			}

			let path = fullurl.pathname.substring(1).split("/");

			// Compatible with API gateway's ability to differentiate versions by path
			// see: /src/config/ConfigProgram.ts in "ignorePathLevel"
			if (configMilkio.ignorePathLevel !== 0) path = path.slice(configMilkio.ignorePathLevel);

			let pathstr = path.join("/") as keyof (typeof schema)["apiMethodsSchema"];

			const detail = {
				path: pathstr,
				ip,
				executeId,
				fullurl,
				request: request.request,
				response,
			};

			// Special processing: do not run middleware when encountering 404 and return quickly
			if (!(pathstr in schema.apiMethodsSchema) || pathstr.startsWith("$/")) {
				// @ts-ignore
				const redirectPath = await routerHandler(pathstr, fullurl);
				if (!redirectPath) {
					const rawbody = await request.request.text();
					loggerPushTags(executeId, {
						body: rawbody || "no body",
					});

					if (!detail.response.body) {
						if (!detail.response.headers["Content-Type"]) detail.response.headers["Content-Type"] = "application/json";
						if (!detail.response.headers["Cache-Control"]) detail.response.headers["Cache-Control"] = "no-cache";
						detail.response.body = `{"executeId":"${executeId}","success":false,"fail":{"code":"NOT_FOUND","message":"${failCode.NOT_FOUND()}"}}`;
					}
					await MiddlewareEvent.handle("httpNotFound", [detail]);

					loggerPushTags(executeId, {
						status: detail.response.status,
						responseHeaders: detail.response.headers,
						timeout: new Date().getTime(),
					});

					await loggerSubmit(executeId);
					runtime.execute.executeIds.delete(executeId);

					return new Response(detail.response.body, detail.response);
				}

				pathstr = redirectPath as typeof pathstr;
			}

			loggerPushTags(executeId, {
				path: pathstr,
			});

			// execute api
			// after request middleware
			await MiddlewareEvent.handle("afterHttpRequest", [headers, detail]);
			const mode = (headers.get("Accept")) === "text/event-stream" ? "stream" : "execute";

			const rawbody = await request.request.text();
			loggerPushTags(executeId, {
				body: rawbody || "no body",
			});

			let params: any;
			try {
				if (rawbody) params = JSON.parse(rawbody);
				else if (request.request.method === 'GET' && fullurl.searchParams.get('params')) {
					params = JSON.parse(decodeURIComponent(fullurl.searchParams.get('params')!));
				} else {
					params = undefined;
				}
			} catch (error) {
				const logger = useLogger(executeId);
				logger.log("TIP: body is not json, the content is not empty, but the content is not in a valid JSON format. The original content value can be retrieved via request.request.text()");
				params = undefined;
			}

			loggerPushTags(executeId, {
				params,
			});

			const resultsRaw = await app._call(mode, pathstr, params, headers, { executeId, logger, detail });

			let fn: any;
			try {
				fn = await schema.apiValidator.validate[pathstr]();
			} catch (error) {
				throw reject("BUSINESS_FAIL", "This is the new API, which takes effect after restarting the server or saving any changes. It will be fixed in the future.");
			}

			if (mode === "execute") {
				const result: string = await fn.validateResults(TSON.encode(resultsRaw.$result));
				if (!detail.response.body) detail.response.body = result;

				// before response middleware
				const middlewareResponse = {
					value: detail.response.body,
				};
				await MiddlewareEvent.handle("beforeHttpResponse", [middlewareResponse, detail]);

				if (!detail.response.headers["Content-Type"]) detail.response.headers["Content-Type"] = "application/json";
				if (!detail.response.headers["Cache-Control"]) detail.response.headers["Cache-Control"] = "no-cache";
				if (!detail.response.body) detail.response.body = middlewareResponse.value;
			}

			if (mode === "stream") {
				const generator = (resultsRaw as any).$generator as AsyncGenerator;
				let stream: ReadableStream;
				let control: ReadableStreamDirectController | ReadableStreamDefaultController;
				// SSE has a default timeout, which helps prevent memory leaks, especially when you are writing code with a while (true) loop

				if (global?.Bun) {
					// bun
					stream = new ReadableStream({
						type: "direct",
						async pull(controller: ReadableStreamDirectController) {
							control = controller;
							try {
								for await (const value of generator) {
									if (!request.request.signal.aborted) {
										const result: string = JSON.stringify(TSON.encode(value));
										controller.write(`data:${result}\n\n`);
									} else {
										generator.return(undefined);
										controller.close();
									}
								}
							} catch (error) {
								controller.close();
								throw error;
							}
							controller.close();
						},
						cancel() {
							control.close();
						},
					} as unknown as UnderlyingByteSource);
				} else {
					// node.js or others
					stream = new ReadableStream({
						async pull(controller) {
							control = controller;
							try {
								for await (const value of generator) {
									if (!request.request.signal.aborted) {
										const result: string = JSON.stringify(TSON.encode(value));
										controller.enqueue(`data:${result}\n\n`);
									} else {
										generator.return(undefined);
										controller.close();
									}
								}
							} catch (error) {
								controller.close();
								throw error;
							}
							controller.close();
						},
						cancel() {
							control.close();
						},
					});
				}
				detail.response.headers["Content-Type"] = "text/event-stream";
				detail.response.headers["Cache-Control"] = "no-cache";
				detail.response.body = stream;
			}
		} catch (error) {
			const result = handleCatchError(error, executeId);
			if (!response.headers["Content-Type"]) response.headers["Content-Type"] = "application/json";
			if (!response.headers["Cache-Control"]) response.headers["Cache-Control"] = "no-cache";
			if (!response.body) response.body = TSON.stringify(result);
		}

		loggerPushTags(executeId, {
			status: response.status,
			responseHeaders: response.headers,
			body: response.body?.toString() ?? "",
			timeout: new Date().getTime(),
		});

		await loggerSubmit(executeId);
		runtime.execute.executeIds.delete(executeId);

		return new Response(response.body, response);
	};

	return fetch;
}

export type MilkioHttpRequest = {
	request: Request;
};

export type MilkioHttpResponse = Mixin<
	ResponseInit,
	{
		body: string | BodyInit;
		status: number;
		headers: Record<string, string>;
	}
>;
