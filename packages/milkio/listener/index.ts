import { createLogger, exceptionHandler, reject } from "../index.ts";
import type { Mixin, GeneratedInit, $types, ContextHttp, MilkioResponseReject, Results, MilkioResponseSuccess } from "../index.ts";
import type { __initExecuter } from "../execute/index.ts";
import { __createId } from "../utils/create-id.ts";
import { Trie } from "../utils/trie.ts";

export type MilkioHttpRequest = Request;

export type MilkioHttpResponse = Mixin<
    ResponseInit,
    {
        // body: string | Blob | FormData | URLSearchParams | ReadableStream<Uint8Array>;
        body: any;
        status: number;
        headers: Record<string, string>;
    }
>;

export function __initListener(generated: GeneratedInit, runtime: any, executer: ReturnType<typeof __initExecuter>) {
    const port = runtime.port;
    const trie = new Trie<any>();
    const fetch = async (options: {
        request: MilkioHttpRequest;
        envMode?: string;
        env?: Record<any, any>;
        routeSchema?: any;
    }): Promise<Response> => {
        if (options.request.method === "OPTIONS") {
            return new Response(undefined, {
                headers: {
                    "Access-Control-Allow-Methods": runtime.cors?.corsAllowMethods ?? "*",
                    "Access-Control-Allow-Origin": runtime.cors?.corsAllowOrigin ?? "*",
                    "Access-Control-Allow-Headers": runtime.cors?.corsAllowHeaders ?? "*",
                },
            });
        }

        if (options.request.url.endsWith("/generate_204")) {
            return new Response(null, {
                status: 204,
                headers: {
                    Server: "milkio",
                    "Access-Control-Allow-Methods": runtime.cors?.corsAllowMethods ?? "*",
                    "Access-Control-Allow-Origin": runtime.cors?.corsAllowOrigin ?? "*",
                    "Access-Control-Allow-Headers": runtime.cors?.corsAllowHeaders ?? "*",
                    "Cache-Control": "no-store",
                    "Content-Type": `text/plain; time=${Date.now()}`,
                },
            });
        }

        const url = new URL(options.request.url);
        let pathArray = url.pathname.substring(1).split("/");
        if (runtime.accessKey && pathArray.at(0) !== runtime.accessKey) {
            return new Response(undefined, {
                status: 403,
                headers: {
                    "Access-Control-Allow-Methods": runtime.cors?.corsAllowMethods ?? "*",
                    "Access-Control-Allow-Origin": runtime.cors?.corsAllowOrigin ?? "*",
                    "Access-Control-Allow-Headers": runtime.cors?.corsAllowHeaders ?? "*",
                },
            });
        }
        if (runtime.ignorePathLevel !== undefined && runtime.ignorePathLevel !== 0) pathArray = pathArray.slice(runtime.ignorePathLevel);
        const pathString = `/${pathArray.join("/")}`;

        const executeId = runtime?.executeId ? await runtime.executeId(options.request.headers) : __createId();

        const logger = createLogger(runtime, pathString, executeId);
        runtime.runtime.request.set(executeId, { logger });
        const response: MilkioHttpResponse = {
            body: "",
            status: 200,
            headers: {
                "Access-Control-Allow-Methods": runtime.cors?.corsAllowMethods ?? "*",
                "Access-Control-Allow-Origin": runtime.cors?.corsAllowOrigin ?? "*",
                "Access-Control-Allow-Headers": runtime.cors?.corsAllowHeaders ?? "*",
                "Cache-Control": "no-store",
                "Content-Type": "application/json",
            },
        };

        let finales: Array<() => void | Promise<void>> = [];


        const http = (await (async () => {
            const ip = runtime.realIp ? runtime.realIp(options.request.headers) : "::1";
            const params = {
                string: await options.request.text(),
                parsed: undefined,
            };

            return {
                url,
                ip,
                path: { string: pathString as keyof $types["generated"]["routeSchema"], array: pathArray },
                params,
                request: options.request,
                response,
            } as ContextHttp;
        })())!;

        try {

            await runtime.emit("milkio:httpRequest", { executeId, logger, path: http.path.string as string, http });

            if (!options.request.headers.get("Accept")?.startsWith("text/event-stream")) {
                // action
                let routeSchema = options.routeSchema;
                if (!routeSchema) {
                    routeSchema = trie.get(http.path.string as string);
                    if (routeSchema === null) {
                        routeSchema = generated.routeSchema?.[http.path.string];
                        if (routeSchema === undefined) {
                            await runtime.emit("milkio:httpNotFound", { executeId, logger, path: http.path.string as string, http });
                            throw reject("NOT_FOUND", { path: http.path.string as string });
                        }
                        if (typeof routeSchema.module !== "function") routeSchema.module = await routeSchema.module;
                        else routeSchema.module = await routeSchema.module();
                        trie.add(http.path.string as string, routeSchema);
                    }

                    if (routeSchema.type !== "action") throw reject("UNACCEPTABLE", { expected: "stream", message: `Not acceptable, the Accept in the request header should be "text/event-stream". If you are using the "@milkio/stargate" package, please add \`type: "stream"\` to the execute options.` });
                }

                const executed = await executer.__execute(routeSchema, {
                    createdExecuteId: executeId,
                    createdLogger: logger,
                    path: http.path.string as string,
                    headers: options.request.headers as Headers,
                    mixinContext: { http, headers: http.request.headers },
                    params: http.params.string,
                    paramsType: "string",
                });
                finales = executed.finales;

                if (response.body === "" && executed.results.value !== undefined) {
                    if (executed.emptyResult) {
                        response.body = `{"data":{},"executeId":"${executeId}","success":true}`;
                    } else if (executed.resultsTypeSafety) {
                        response.body = `{"data":${routeSchema.resultsToJSON(executed.results.value)},"executeId":"${executeId}","success":true}`;
                    } else {
                        response.body = `{"data":${JSON.stringify(executed.results.value)},"executeId":"${executeId}","success":true}`;
                    }
                }

                await runtime.emit("milkio:httpResponse", { executeId, logger, path: http.path.string as string, http, headers: http.request.headers, context: executed.context, success: true });

                for (const handler of finales) {
                    try {
                        await handler();
                    } catch (error) {
                        logger.error("An error occurred inside onFinally.", error);
                    }
                }

                runtime.runtime.request.delete(executeId);
                return new Response(response.body, response);
            } else {
                // stream
                let routeSchema = options.routeSchema;
                if (!routeSchema) {
                    routeSchema = trie.get(http.path.string as string);
                    if (routeSchema === null) {
                        routeSchema = generated.routeSchema?.[http.path.string];
                        if (routeSchema === undefined) {
                            await runtime.emit("milkio:httpNotFound", { executeId, logger, path: http.path.string as string, http });
                            throw reject("NOT_FOUND", { path: http.path.string as string });
                        }
                        if (typeof routeSchema.module !== "function") routeSchema.module = await routeSchema.module;
                        else routeSchema.module = await routeSchema.module();
                        trie.add(http.path.string as string, routeSchema);
                    }
                    if (routeSchema.type !== "stream") throw reject("UNACCEPTABLE", { expected: "stream", message: `Not acceptable, the Accept in the request header should be "application/json". If you are using the "@milkio/stargate" package, please remove \`type: "stream"\` to the execute options.` });
                }

                const handleClose = async () => {
                    runtime.runtime.request.delete(executeId);
                    for (const handler of finales) {
                        try {
                            await handler();
                        } catch (error) {
                            logger.error("An error occurred inside onFinally.", error);
                        }
                    }
                };

                const executed = await executer.__execute(routeSchema, {
                    createdExecuteId: executeId,
                    createdLogger: logger,
                    path: http.path.string as string,
                    headers: options.request.headers as Headers,
                    mixinContext: { http, headers: http.request.headers },
                    params: http.params.string,
                    paramsType: "string",
                });
                finales = executed.finales;
                // @ts-ignore: bun
                let stream: ReadableStream;
                // @ts-ignore: bun
                let control: ReadableStreamDirectController | ReadableStreamDefaultController;

                // @ts-ignore: bun
                if (typeof Bun !== "undefined") {
                    // @ts-ignore: bun
                    stream = new ReadableStream({
                        type: "direct",
                        // @ts-ignore: bun
                        async pull(controller: ReadableStreamDirectController) {
                            control = controller;
                            try {
                                controller.write(`data:@${JSON.stringify({ success: true, data: undefined, executeId } satisfies MilkioResponseSuccess<any>)}\n\n`);
                                for await (const value of executed.results.value) {
                                    if (!options.request.signal.aborted) {
                                        const result: string = JSON.stringify([null, value]);
                                        controller.write(`data:${result}\n\n`);
                                    } else {
                                        executed.results.value.return(undefined);
                                        await handleClose();
                                        controller.close();
                                    }
                                }
                            } catch (error) {
                                const exception = exceptionHandler(executeId, logger, error);
                                const result: any = {};
                                result[exception.code] = exception.reject;
                                controller.write(`data:${JSON.stringify([result, null])}\n\n`);
                            }
                            await new Promise((resolve) => setTimeout(resolve, 0));
                            await handleClose();
                            controller.close();
                        },
                        async cancel() {
                            await handleClose();
                            control.close();
                        },
                    } as any);
                } else {
                    // node.js or others
                    // @ts-ignore: bun
                    stream = new ReadableStream({
                        // @ts-ignore: bun
                        async pull(controller) {
                            control = controller;
                            try {
                                controller.enqueue(`data:@${JSON.stringify({ success: true, data: undefined, executeId } satisfies MilkioResponseSuccess<any>)}\n\n`);
                                for await (const value of executed.results.value) {
                                    if (!options.request.signal.aborted) {
                                        const result: string = JSON.stringify([null, value]);
                                        controller.enqueue(`data:${result}\n\n`);
                                    } else {
                                        executed.results.value.return(undefined);
                                        await handleClose();
                                        controller.close();
                                    }
                                }
                            } catch (error) {
                                const exception = exceptionHandler(executeId, logger, error);
                                const result: any = {};
                                result[exception.code] = exception.reject;
                                controller.enqueue(`data:${JSON.stringify([result, null])}\n\n`);
                            }
                            await handleClose();
                            await new Promise((resolve) => setTimeout(resolve, 0));
                            controller.close();
                        },
                        async cancel() {
                            await handleClose();
                            control.close();
                        },
                    } as any);
                }

                response.body = stream;
                response.headers["Content-Type"] = "text/event-stream";
                response.headers["Cache-Control"] = "no-cache";

                await runtime.emit("milkio:httpResponse", { executeId, logger, path: http.path.string as string, http, headers: http.request.headers, context: executed.context, success: true });

                return new Response(response.body, response);
            }
        } catch (error) {
            const results: Results<MilkioResponseReject> = {
                value: exceptionHandler(executeId, logger, error),
            };
            if (results.value !== undefined) response.body = JSON.stringify(results.value);
            await runtime.emit("milkio:httpResponse", { executeId, logger, path: http.path.string as string, http, headers: http.request.headers, context: response.body, success: false });
            runtime.runtime.request.delete(executeId);
            return new Response(response.body, response);
        }
    };

    const streamClosers: Map<string, { generator: AsyncGenerator; handleClose: any }> = new Map();
    const handleMessage = async (
        port: { postMessage(message: any): void },
        options:
            | {
                executeId: string;
                path: string;
                params?: Record<any, any>;
                headers?: Record<string, string>;
            }
            | string,
    ) => {
        if (typeof options === "string") {
            if (options === "PING") {
                port.postMessage("PONG");
            }
            if (options.startsWith("CLOSE_STREAM:")) {
                const executeId = options.split("CLOSE_STREAM:")[1];
                const streamCloser = streamClosers.get(executeId);
                if (streamCloser) {
                    streamCloser.generator.return(undefined);
                    streamCloser.handleClose("stream");
                }
            }
            return;
        }
        let routeSchema = trie.get(options.path);
        if (routeSchema === null) {
            routeSchema = generated.routeSchema?.[options.path];
            if (routeSchema === undefined) {
                throw reject("NOT_FOUND", { path: options.path });
            }
            if (typeof routeSchema.module !== "function") routeSchema.module = await routeSchema.module;
            else routeSchema.module = await routeSchema.module();
            trie.add(options.path, routeSchema);
        }

        const headers = new Headers(options.headers);
        const params = options.params ?? {};
        const logger = createLogger(runtime, options.path, options.executeId);
        let finales: Array<() => void | Promise<void>> = [];

        const http = new Proxy(
            {},
            {
                get: (target, property) => {
                    if (property === "notFound") return true;
                    return undefined;
                },
                set: () => {
                    throw reject("UNACCEPTABLE", { expected: "context.http", message: "This request was invoked through the execute method. Since no actual request was generated, the HTTP methods under the context cannot be accessed." });
                },
            },
        );

        const handleClose = async (type: "action" | "stream") => {
            if (type === "stream") streamClosers.delete(options.executeId);
            runtime.runtime.request.delete(options.executeId);
            for (const handler of finales) {
                try {
                    await handler();
                } catch (error) {
                    logger.error("An error occurred inside onFinally.", error);
                }
            }
        };

        try {
            if (routeSchema.type === "action") {
                const executed = await executer.__execute(routeSchema, {
                    createdExecuteId: options.executeId,
                    createdLogger: logger,
                    path: options.path,
                    headers,
                    mixinContext: { http: http, headers },
                    params,
                    paramsType: "raw",
                });
                finales = executed.finales;

                await handleClose("action");

                if (executed.emptyResult) {
                    port.postMessage({
                        executeId: options.executeId,
                        success: true,
                        data: undefined,
                    });
                } else {
                    port.postMessage({
                        executeId: options.executeId,
                        success: true,
                        data: executed.results.value,
                    });
                }
            }
            if (routeSchema.type === "stream") {
                const executed = await executer.__execute(routeSchema, {
                    createdExecuteId: options.executeId,
                    createdLogger: logger,
                    path: options.path,
                    headers,
                    mixinContext: { http: http, headers },
                    params,
                    paramsType: "raw",
                });
                finales = executed.finales;

                try {
                    port.postMessage({ success: true, data: undefined, executeId: options.executeId, done: false });
                    streamClosers.set(options.executeId, { generator: executed.results.value, handleClose });
                    for await (const value of executed.results.value) {
                        const data = { success: true, data: [null, value], executeId: options.executeId, done: false };
                        port.postMessage(data);
                    }
                    port.postMessage({ success: true, data: undefined, executeId: options.executeId, done: true });
                } catch (error) {
                    const exception = exceptionHandler(options.executeId, logger, error);
                    const result: any = {};
                    result[exception.code] = exception.reject;
                    port.postMessage({ success: true, data: [result, null], executeId: options.executeId, done: true });
                }
                await handleClose("stream");
            }
        } catch (error) {
            const result = exceptionHandler(options.executeId, logger, error);
            port.postMessage({ success: false, data: undefined, error: result, executeId: options.executeId, done: true });
        }
    };

    return {
        port,
        fetch,
        handleMessage,
    };
}
