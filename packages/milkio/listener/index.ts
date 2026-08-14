import { createLogger, exceptionHandler, reject, raise } from "../index.ts";
import type { Mixin, GeneratedInit, $types, ContextHttp, MilkioResponseReject, Results, MilkioResponseSuccess, CorsConfig, Logger, Log } from "../index.ts";
import type { __initExecuter } from "../execute/index.ts";
import { __createId } from "../utils/create-id.ts";
import { Trie } from "../utils/trie.ts";
import { buildCorsHeaders } from "../utils/build-cors-headers.ts";
import { reviveJSONParse } from "../utils/revive-json-parse.ts";
import { sanitizeExecuteId } from "../utils/sanitize-execute-id.ts";

export type MilkioHttpRequest = Request;

export type MilkioHttpResponse = Mixin<
    ResponseInit,
    {
        body: string | ReadableStream<Uint8Array> | Uint8Array | ArrayBuffer | Blob | null;
        status: number;
        headers: Record<string, string>;
    }
>;

export function __initListener(generated: GeneratedInit, runtime: any, executer: ReturnType<typeof __initExecuter>) {
    const port = runtime.port;
    const trie = new Trie<any>();
    // Pre-compute default CORS config and cache headers per origin
    const cors: CorsConfig = { corsAllowMethods: ["POST", "OPTIONS"], corsAllowHeaders: ["Content-Type", "Authorization"], corsMaxAge: 0, ...runtime.http?.cors };
    const corsHeadersCache = new Map<string, Record<string, string>>();
    const MAX_CORS_HEADERS_CACHE_SIZE = 1024;
    const getCorsHeaders = (origin: string | null): Record<string, string> => {
        const key = origin ?? "";
        let cached = corsHeadersCache.get(key);
        if (cached !== undefined) return cached;
        if (corsHeadersCache.size >= MAX_CORS_HEADERS_CACHE_SIZE) corsHeadersCache.clear();
        cached = buildCorsHeaders(cors, origin);
        corsHeadersCache.set(key, cached);
        return cached;
    };
    // Pre-compute default response headers (without origin-specific CORS)
    const defaultResponseHeaders: Record<string, string> = {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
    };
    // Pre-compute merged headers for null origin (most common case)
    const defaultMergedHeaders: Record<string, string> = { ...getCorsHeaders(null), ...defaultResponseHeaders };

    // Pre-allocate response template parts for Fast Path
    const emptyResultPrefix = '{"data":{},"executeId":"';
    const resultPrefix = '{"data":';
    const idSuffix = '","success":true}';
    // Shared response object for Fast Path (handler returns result directly, never modifies response)
    const fastPathResponse = { body: "", status: 200, headers: defaultMergedHeaders };

    // Dynamic check for event handlers with version-based caching
    let cachedNoEmitHandlers = true;
    let lastEmitHandlersVersion = -1;
    const checkNoEmitHandlers = (): boolean => {
        const v = runtime._emitHandlersVersion;
        if (v !== lastEmitHandlersVersion) {
            lastEmitHandlersVersion = v;
            cachedNoEmitHandlers =
                !runtime._hasEmitHandlers?.("milkio:executeBefore") &&
                !runtime._hasEmitHandlers?.("milkio:executeAfter") &&
                !runtime._hasEmitHandlers?.("milkio:httpRequest") &&
                !runtime._hasEmitHandlers?.("milkio:httpResponse") &&
                !runtime._hasEmitHandlers?.("milkio:httpNotFound");
        }
        return cachedNoEmitHandlers;
    };
    const hasOnLoggerSubmitting = !!runtime.onLoggerSubmitting;

    // Shared no-op logger for fast path (used when no event handlers)
    const noopLogger: Logger = {
        _: { logs: [] as any, tags: new Map<string, unknown>(), submit: () => { } },
        setTag: () => { },
        setLog: (..._log: Log) => ({} as Log),
        debug: (_description: string, ..._params: Array<unknown>) => ({} as Log),
        info: (_description: string, ..._params: Array<unknown>) => ({} as Log),
        warn: (_description: string, ..._params: Array<unknown>) => ({} as Log),
        error: (_description: string, ..._params: Array<unknown>) => ({} as Log),
        request: (_description: string, ..._params: Array<unknown>) => ({} as Log),
        response: (_description: string, ..._params: Array<unknown>) => ({} as Log),
    };

    // Pre-create base context prototype for Fast Path (shared immutable properties)
    // `call` is defined on prototype to avoid creating a closure per request
    const baseContextProto: any = {
        reject,
        develop: runtime.develop,
        logger: noopLogger,
        emit: runtime.emit,
        emitAnyApproved: runtime.emitAnyApproved,
        emitAllApproved: runtime.emitAllApproved,
        config: runtime.runtime.config,
        typia: generated.typiaSchema,
        onFinally: () => { },
        _: runtime,
        call(module: any, p: any) { return executer.__call(this, module, p); },
    };

    // Hot path cache: pre-resolve the most common route
    let cachedRouteSchema: any = null;
    let cachedPathString: string | null = null;
    // Cache validateParams and handler references to avoid property lookups
    let cachedValidateParams: any = null;
    let cachedHandler: any = null;
    let cachedSkipValidation: boolean = false;

    const fetch = async (options: {
        request: MilkioHttpRequest;
        envMode?: string;
        env?: Record<any, any>;
        routeSchema?: any;
        rawResponse?: boolean;
    }): Promise<Response> => {
        const MAX_BODY_SIZE = 10 * 1024 * 1024;
        const tooLarge = () => reject("REQUEST_TOO_LARGE", { maxBodySize: MAX_BODY_SIZE });
        const readBodyText = async (): Promise<string> => {
            const preRead = (options.request as any).__bodyText;
            if (preRead !== undefined) {
                if (typeof preRead === "string" && preRead.length > MAX_BODY_SIZE) throw tooLarge();
                return preRead;
            }
            const contentLength = Number(options.request.headers.get("content-length") ?? "0");
            if (Number.isFinite(contentLength) && contentLength > MAX_BODY_SIZE) throw tooLarge();
            if (!options.request.body) return "";
            const reader = options.request.body.getReader();
            const decoder = new TextDecoder();
            let text = "";
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    text += decoder.decode(value, { stream: true });
                    if (text.length > MAX_BODY_SIZE) {
                        await reader.cancel().catch(() => {});
                        throw tooLarge();
                    }
                }
                text += decoder.decode();
            } finally {
                reader.releaseLock();
            }
            return text;
        };

        // Use pre-passed origin from adapter to avoid headers.get() call
        const origin = (options.request as any).__origin ?? options.request.headers.get("Origin");

        if (options.request.method === "OPTIONS") {
            return new Response(undefined, {
                headers: getCorsHeaders(origin),
            });
        }

        // Use pre-parsed pathname and pathArray if available (from adapter), otherwise parse
        const pathname = (options.request as any).__pathname ?? new URL(options.request.url).pathname;
        if (pathname.endsWith("/generate_204")) {
            const corsHeaders = getCorsHeaders(origin);
            return new Response(null, {
                status: 204,
                headers: {
                    Server: "milkio",
                    ...corsHeaders,
                    "Cache-Control": "no-store",
                    "Content-Type": `text/plain; time=${Date.now()}`,
                },
            });
        }

        const prePathArray = (options.request as any).__pathArray;
        let pathString: string;
        let pathArray: string[];
        if (!runtime.accessKey && (!runtime.ignorePathLevel || runtime.ignorePathLevel === 0)) {
            pathString = pathname;
            pathArray = prePathArray ?? pathname.substring(1).split("/");
        } else {
            pathArray = prePathArray ?? pathname.substring(1).split("/");
            if (runtime.accessKey && pathArray.at(0) !== runtime.accessKey) {
                const corsHeaders = getCorsHeaders(origin);
                if (options.rawResponse) return { __rawResponse: true, body: "", status: 403, headers: corsHeaders } as any;
                return new Response(undefined, {
                    status: 403,
                    headers: corsHeaders,
                });
            }
            if (runtime.ignorePathLevel !== undefined && runtime.ignorePathLevel !== 0) pathArray = pathArray.slice(runtime.ignorePathLevel);
            pathString = `/${pathArray.join("/")}`;
        }

        // Pre-read body text if available (from adapter), otherwise use async request.text()
        const bodyText = (options.request as any).__bodyText;
        const ip = runtime.realIp ? runtime.realIp(options.request.headers) : "::1";

        // 测试环境下的 $event 端点：通过 base64 编码的事件名触发事件
        if (options.envMode === "test" && pathString.startsWith("/$event/")) {
            const base64Name = decodeURIComponent(pathString.slice(8));
            let eventName: string;
            try {
                // 兼容不同运行时：优先使用 atob，回退到 Buffer
                if (typeof atob !== "undefined") {
                    eventName = atob(base64Name);
                } else if (typeof Buffer !== "undefined") {
                    eventName = Buffer.from(base64Name, "base64").toString();
                } else {
                    throw new Error("No base64 decoder available");
                }
            } catch {
                const corsHeaders = getCorsHeaders(origin);
                const body = JSON.stringify({ success: false, code: "PARAMS_TYPE_NOT_SUPPORTED", reject: { expected: "valid base64 event name" } });
                if (options.rawResponse) return { __rawResponse: true, body, status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } } as any;
                return new Response(body, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            let eventData: any = undefined;
            const rawBody = await readBodyText();
            if (rawBody && rawBody !== "" && rawBody !== "{}") {
                try {
                    eventData = reviveJSONParse(JSON.parse(rawBody));
                } catch {
                    const corsHeaders = getCorsHeaders(origin);
                    const body = JSON.stringify({ success: false, code: "PARAMS_TYPE_NOT_SUPPORTED", reject: { expected: "json" } });
                    if (options.rawResponse) return { __rawResponse: true, body, status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } } as any;
                    return new Response(body, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
            }

            const executeId = __createId();
            const corsHeaders = getCorsHeaders(origin);
            const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };

            // 自动注入 context — event 数据中约定俗成的 context 参数无法由外部传参，由服务端补全。
            // 与 action 执行保持一致：构建完整的 context（logger/config/typia/call 等），并触发
            // milkio:executeBefore / milkio:httpResponse 事件，使 bootstrap 可以注入 db/redis 等能力。
            if (eventData && typeof eventData === "object" && !Array.isArray(eventData) && !("context" in eventData)) {
                const context: any = {};
                context.reject = reject;
                context.raise = raise;
                context.develop = runtime.develop;
                context.executeId = executeId;
                context.path = pathString;
                context.emit = runtime.emit;
                context.emitAnyApproved = runtime.emitAnyApproved;
                context.emitAllApproved = runtime.emitAllApproved;
                context._ = runtime;
                context.config = runtime.runtime.config;
                context.typia = generated.typiaSchema;
                context.call = (module: any, params: any) => executer.__call(context, module, params);
                context.onFinally = () => {};
                const logger = createLogger(runtime, pathString, executeId);
                context.logger = logger;
                context.http = {
                    ip,
                    params: { string: rawBody ?? "", parsed: eventData },
                    request: options.request,
                };
                eventData.context = context;

                const emitHttpResponse = (success: boolean) => {
                    if (runtime._hasEmitHandlers?.("milkio:httpResponse") ?? true) {
                        return runtime.emit("milkio:httpResponse", { executeId, logger, path: pathString, http: context.http, headers: options.request.headers, context, success, reject, raise });
                    }
                };

                try {
                    // 先触发 executeBefore（bootstrap 注入 db/redis），事件处理完成后再触发
                    // httpResponse（释放连接），与 action 的生命周期保持一致。
                    if (runtime._hasEmitHandlers?.("milkio:executeBefore") ?? true) {
                        await runtime.emit("milkio:executeBefore", { executeId, logger, path: pathString, meta: {}, context, reject, raise });
                    }
                    await runtime.emit(eventName, eventData);
                } catch (emitError) {
                    const errResult = exceptionHandler(executeId, logger, emitError);
                    const errBody = JSON.stringify(errResult);
                    try {
                        await emitHttpResponse(false);
                    } catch {}
                    if (options.rawResponse) return { __rawResponse: true, body: errBody, status: 200, headers: jsonHeaders } as any;
                    return new Response(errBody, { status: 200, headers: jsonHeaders });
                }

                try {
                    await emitHttpResponse(true);
                } catch {}
            } else {
                try {
                    await runtime.emit(eventName, eventData);
                } catch (emitError) {
                    const errResult = exceptionHandler(executeId, noopLogger, emitError);
                    const errBody = JSON.stringify(errResult);
                    if (options.rawResponse) return { __rawResponse: true, body: errBody, status: 200, headers: jsonHeaders } as any;
                    return new Response(errBody, { status: 200, headers: jsonHeaders });
                }
            }

            const body = `{"data":${JSON.stringify(eventData ?? {}, (key, value) => key === "context" ? undefined : value)},"executeId":"${executeId}","success":true}`;
            if (options.rawResponse) return { __rawResponse: true, body, status: 200, headers: jsonHeaders } as any;
            return new Response(body, { status: 200, headers: jsonHeaders });
        }

        // ===== FAST PATH for common action requests =====
        // Skip logger, request map, and most object creation when:
        // - rawResponse mode (adapter)
        // - No origin header (no CORS needed)
        // - No event handlers registered (dynamic check)
        // - Not a stream request
        if (options.rawResponse && !origin && checkNoEmitHandlers()) {
            const __isAction = (options.request as any).__isAction;
            if (__isAction !== false) {
                // Resolve route schema with hot cache
                let routeSchema = options.routeSchema;
                if (!routeSchema) {
                    if (pathString === cachedPathString && cachedRouteSchema) {
                        routeSchema = cachedRouteSchema;
                    } else {
                        routeSchema = trie.get(pathString);
                        if (routeSchema !== null) {
                            cachedRouteSchema = routeSchema;
                            cachedPathString = pathString;
                        } else {
                            routeSchema = generated.routeSchema?.[pathString];
                            if (routeSchema === undefined) {
                                // 404 - fall through to slow path for proper error handling
                            } else {
                                if (typeof routeSchema.module !== "function") routeSchema.module = await routeSchema.module;
                                else routeSchema.module = await routeSchema.module();
                                trie.add(pathString, routeSchema);
                                cachedRouteSchema = routeSchema;
                                cachedPathString = pathString;
                            }
                        }
                    }
                }

                if (routeSchema && routeSchema.type === "action") {
                    // Use cached function references when hitting the same route
                    let validateParams = cachedValidateParams;
                    let handler = cachedHandler;
                    let skipValidation = cachedSkipValidation;
                    if (routeSchema !== cachedRouteSchema) {
                        validateParams = routeSchema.validateParams;
                        handler = routeSchema.module.handler;
                        const meta = routeSchema.module?.meta;
                        skipValidation = meta?.typeSafety === false || (Array.isArray(meta?.typeSafety) && !meta.typeSafety.includes("params"));
                        cachedValidateParams = validateParams;
                        cachedHandler = handler;
                        cachedSkipValidation = skipValidation;
                    }

                    const executeId = __createId();
                    const body = await readBodyText();

                    // Parse params
                    let params: any;
                    let paramsOk = true;
                    if (!body || body === "" || body === "{}") {
                        params = {};
                    } else {
                        try {
                            params = reviveJSONParse(JSON.parse(body));
                            if (typeof params === "undefined") params = {};
                        } catch {
                            paramsOk = false;
                        }
                    }

                    if (paramsOk && params !== null && typeof params === "object" && !Array.isArray(params)) {
                        // Skip $milkioGenerateParams in test mode
                        if (options.envMode === "test" || !("$milkioGenerateParams" in params)) {
                            // Validate params when typeSafety is enabled
                            if (!skipValidation) {
                                const validation = validateParams(params);
                                if (!validation.success) {
                                    // Validation failed - fall through to slow path
                                    paramsOk = false;
                                }
                            }

                            if (paramsOk) {
                                // Build minimal context using prototype for shared properties
                                const context: any = Object.create(baseContextProto);
                                context.path = pathString;
                                context.routeType = "action";
                                context.executeId = executeId;
                                context.http = {
                                    url: pathname,
                                    ip,
                                    path: { string: pathString, array: pathArray },
                                    params: { string: body, parsed: params },
                                    request: options.request,
                                    response: fastPathResponse,
                                    cors,
                                };
                                context.headers = options.request.headers;

                                try {
                                    const result = await handler(context, params);

                                    if (result === undefined || result === null || result === "") {
                                        return { __rawResponse: true, body: emptyResultPrefix + executeId + idSuffix, status: 200, headers: defaultMergedHeaders } as any;
                                    } else if (!Array.isArray(result) && typeof result === "object") {
                                        return { __rawResponse: true, body: resultPrefix + JSON.stringify(result) + ',"executeId":"' + executeId + idSuffix, status: 200, headers: defaultMergedHeaders } as any;
                                    }
                                    // Invalid result type - fall through to slow path
                                } catch {
                                    // Handler threw - fall through to slow path for proper error handling
                                }
                            }
                        }
                    }
                }
            }
        }

        // ===== SLOW PATH =====
        const corsHeaders = getCorsHeaders(origin);
        const rawExecuteId = runtime?.executeId ? await runtime.executeId(options.request.headers) : __createId();
        const executeId = sanitizeExecuteId(rawExecuteId) || __createId();
        const anyEmitHandlers = !checkNoEmitHandlers();

        const logger = createLogger(runtime, pathString, executeId);
        if (anyEmitHandlers) runtime.runtime.request.set(executeId, { logger });
        // Pre-compute base headers for this request (CORS + defaults)
        const baseHeaders: Record<string, string> = origin ? { ...corsHeaders, ...defaultResponseHeaders } : defaultMergedHeaders;

        let finales: Array<() => void | Promise<void>> = [];

        const response: MilkioHttpResponse = {
            body: "",
            status: 200,
            headers: { ...baseHeaders },
        };

        // Check if this is a raw route — raw routes bypass action/stream logic
        // and let the handler own the full Request/Response lifecycle.
        const isRawPath = generated.rawSchema?.rawPaths?.has(pathString) ?? false;

        const http: ContextHttp = {
            url: pathname as any,
            ip,
            path: { string: pathString as keyof $types["generated"]["routeSchema"], array: pathArray },
            params: {
                // For raw routes, don't consume the request body — the handler
                // needs it intact. The body will be passed via the Request object.
                string: isRawPath ? "" : (await readBodyText()),
                parsed: undefined,
            },
            request: options.request,
            response,
            cors,
        };

        const context: any = { reject, raise };
        try {
            // Check if emit has handlers before awaiting
            const hasHttpRequestHandlers = runtime._hasEmitHandlers?.("milkio:httpRequest") ?? true;
            if (hasHttpRequestHandlers) await runtime.emit("milkio:httpRequest", { executeId, logger, path: http.path.string as string, http, reject, raise });

            // 非 test 环境下拦截 $exports 内部路径
            if (options.envMode !== "test" && (http.path.string as string).includes("$")) {
                await runtime.emit("milkio:httpNotFound", { executeId, logger, path: http.path.string as string, http, reject, raise });
                throw reject("NOT_FOUND", { path: http.path.string as string });
            }

            // ===== RAW PATH =====
            // Raw routes receive a native Request and return a native Response.
            // They bypass typia validation, JSON serialization, and stargate.
            // Use case: SSE passthrough (e.g. OpenAI proxy), webhooks, binary.
            if (isRawPath) {
                const rawRoute = generated.rawSchema.routes[pathString];
                if (!rawRoute) {
                    await runtime.emit("milkio:httpNotFound", { executeId, logger, path: http.path.string as string, http, reject, raise });
                    throw reject("NOT_FOUND", { path: http.path.string as string });
                }
                // Lazy-load module on first access, then cache
                let module: any = rawRoute.module;
                if (typeof module === "function") {
                    module = await module();
                    rawRoute.module = module;
                }
                const meta = module?.meta ?? {};

                // Construct full context (raw doesn't go through __execute,
                // so we set all fields manually here)
                context.http = http;
                context.headers = http.request.headers;
                context.develop = runtime.develop;
                context.path = pathString;
                context.routeType = "raw";
                context.logger = logger;
                context.emit = runtime.emit;
                context.emitAnyApproved = runtime.emitAnyApproved;
                context.emitAllApproved = runtime.emitAllApproved;
                context.executeId = executeId;
                context.config = runtime.runtime.config;
                context.typia = generated.typiaSchema;
                context.call = (mod: any, params: any) => executer.__call(context, mod, params);
                context.onFinally = (handler: any) => finales.unshift(handler);
                context._ = runtime;

                // If adapter pre-read the body (bodyText set), reconstruct a
                // Request with the body re-injected so the handler can read it.
                // Otherwise, the original request body is still intact (we skipped
                // reading it above for raw paths).
                const handlerRequest: Request = bodyText !== undefined
                    ? new Request(options.request.url, {
                        method: options.request.method,
                        headers: options.request.headers,
                        body: bodyText || null,
                        signal: options.request.signal,
                    })
                    : options.request;

                const results: Results<any> = { value: undefined };

                if (runtime._hasEmitHandlers?.("milkio:executeBefore") ?? true) {
                    await runtime.emit("milkio:executeBefore", { executeId, logger, path: pathString, meta, context, reject, raise });
                }

                const rawResponse: Response = await module.handler(context, handlerRequest);
                results.value = rawResponse;

                if (runtime._hasEmitHandlers?.("milkio:executeAfter") ?? true) {
                    await runtime.emit("milkio:executeAfter", { executeId, logger, path: pathString, meta, context, results, reject, raise });
                }

                // Apply CORS headers to the raw response
                const finalHeaders = new Headers(rawResponse.headers);
                for (const [k, v] of Object.entries(corsHeaders)) {
                    if (!finalHeaders.has(k)) finalHeaders.set(k, v);
                }

                const hasHttpResponseHandlers = runtime._hasEmitHandlers?.("milkio:httpResponse") ?? true;
                if (hasHttpResponseHandlers) await runtime.emit("milkio:httpResponse", { executeId, logger, path: http.path.string as string, http, headers: http.request.headers, context, success: true, reject, raise });

                // Run onFinally handlers (after httpResponse, matching action path ordering)
                if (finales.length > 0) {
                    for (const handler of finales) {
                        try { await handler(); } catch (error) { logger.error("An error occurred inside onFinally.", error); }
                    }
                }

                if (hasOnLoggerSubmitting) await logger._.submit(context as any);
                if (anyEmitHandlers) runtime.runtime.request.delete(executeId);

                return new Response(rawResponse.body, {
                    status: rawResponse.status,
                    statusText: rawResponse.statusText,
                    headers: finalHeaders,
                });
            }

            if (!options.request.headers.get("Accept")?.startsWith("text/event-stream")) {
                // action
                let routeSchema = options.routeSchema;
                if (!routeSchema) {
                    // Hot path: check single-entry cache first
                    if (pathString === cachedPathString && cachedRouteSchema) {
                        routeSchema = cachedRouteSchema;
                    } else if ((http.path.string as string).includes("$")) {
                        routeSchema = trie.get(http.path.string as string);
                        if (routeSchema === null) {
                            routeSchema = generated.routeSchema?.[http.path.string];
                            if (routeSchema === undefined) {
                                await runtime.emit("milkio:httpNotFound", { executeId, logger, path: http.path.string as string, http, reject, raise });
                                throw reject("NOT_FOUND", { path: http.path.string as string });
                            }
                            if (typeof routeSchema.module !== "function") routeSchema.module = await routeSchema.module;
                            else routeSchema.module = await routeSchema.module();
                            trie.add(http.path.string as string, routeSchema);
                        }
                    } else {
                        routeSchema = trie.get(http.path.string as string);
                        if (routeSchema === null) {
                            routeSchema = generated.routeSchema?.[http.path.string];
                            if (routeSchema === undefined) {
                                await runtime.emit("milkio:httpNotFound", { executeId, logger, path: http.path.string as string, http, reject, raise });
                                throw reject("NOT_FOUND", { path: http.path.string as string });
                            }
                            if (typeof routeSchema.module !== "function") routeSchema.module = await routeSchema.module;
                            else routeSchema.module = await routeSchema.module();
                            trie.add(http.path.string as string, routeSchema);
                        }
                        // Update hot path cache
                        cachedRouteSchema = routeSchema;
                        cachedPathString = pathString;
                    }

                    if (routeSchema.type !== "action") throw reject("UNACCEPTABLE", { expected: "stream", message: `Not acceptable, the Accept in the request header should be "text/event-stream". If you are using the "@milkio/stargate" package, please add \`type: "stream"\` to the execute options.` });
                }

                context.http = http;
                context.headers = http.request.headers;
                context.routeType = "action";

                const executed = await executer.__execute(routeSchema, {
                    createdExecuteId: executeId,
                    createdLogger: logger,
                    path: http.path.string as string,
                    headers: options.request.headers as Headers,
                    context,
                    params: http.params.string,
                    paramsType: "string",
                    paramsContentType: "json",
                });
                finales = executed.finales;

                if (response.body === "" && executed.results.value !== undefined) {
                    if (executed.emptyResult) {
                        response.body = `{"data":{},"executeId":"${executeId}","success":true}`;
                    } else {
                        response.body = `{"data":${JSON.stringify(executed.results.value)},"executeId":"${executeId}","success":true}`;
                    }
                }

                const hasHttpResponseHandlers = runtime._hasEmitHandlers?.("milkio:httpResponse") ?? true;
                if (hasHttpResponseHandlers) await runtime.emit("milkio:httpResponse", { executeId, logger, path: http.path.string as string, http, headers: http.request.headers, context: executed.context, success: true, reject, raise });

                if (finales.length > 0) {
                    for (const handler of finales) {
                        try {
                            await handler();
                        } catch (error) {
                            logger.error("An error occurred inside onFinally.", error);
                        }
                    }
                }

                if (hasOnLoggerSubmitting) await logger._.submit(context as any);
                if (anyEmitHandlers) runtime.runtime.request.delete(executeId);
                if (options.rawResponse) {
                    return { __rawResponse: true, body: response.body, status: response.status, headers: response.headers } as any;
                }
                return new Response(response.body as BodyInit | null, response);
            } else {
                // stream
                let routeSchema = options.routeSchema;
                if (!routeSchema) {
                    routeSchema = trie.get(http.path.string as string);
                    if ((http.path.string as string).includes("$") || !(http.path.string as string).endsWith("~") || routeSchema === null) {
                        routeSchema = generated.routeSchema?.[http.path.string];
                        if (routeSchema === undefined) {
                            await runtime.emit("milkio:httpNotFound", { executeId, logger, path: http.path.string as string, http, reject, raise });
                            throw reject("NOT_FOUND", { path: http.path.string as string });
                        }
                        if (typeof routeSchema.module !== "function") routeSchema.module = await routeSchema.module;
                        else routeSchema.module = await routeSchema.module();
                        trie.add(http.path.string as string, routeSchema);
                    }
                    if (routeSchema.type !== "stream") throw reject("UNACCEPTABLE", { expected: "stream", message: `Not acceptable, the Accept in the request header should be "application/json". If you are using the "@milkio/stargate" package, please remove \`type: "stream"\` to the execute options.` });
                }

                let streamClosed = false;
                const handleClose = async () => {
                    if (streamClosed) return;
                    streamClosed = true;
                    for (const handler of finales) {
                        try {
                            await handler();
                        } catch (error) {
                            logger.error("An error occurred inside onFinally.", error);
                        }
                    }
                    if (hasOnLoggerSubmitting) await logger._.submit(context as any);
                    if (anyEmitHandlers) runtime.runtime.request.delete(executeId);
                };

                context.http = http;
                context.headers = http.request.headers;
                context.routeType = "stream";

                const executed = await executer.__execute(routeSchema, {
                    createdExecuteId: executeId,
                    createdLogger: logger,
                    path: http.path.string as string,
                    headers: options.request.headers as Headers,
                    context,
                    params: http.params.string,
                    paramsType: "string",
                });
                finales = executed.finales;
                // Stream path: create new headers object to avoid polluting shared defaultMergedHeaders
                response.headers = { ...response.headers, ...buildCorsHeaders(http.cors, origin) };
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
                                    if (!options.request.signal?.aborted) {
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
                // Stream path: create new headers to avoid polluting shared object
                response.headers = { ...response.headers, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" };

                await runtime.emit("milkio:httpResponse", { executeId, logger, path: http.path.string as string, http, headers: http.request.headers, context: executed.context, success: true, reject, raise });

                return new Response(response.body, response);
            }
        } catch (error) {
            const results: Results<MilkioResponseReject> = {
                value: exceptionHandler(executeId, logger, error),
            };
            if (results.value !== undefined) response.body = JSON.stringify(results.value);
            // Error path: create new headers to avoid polluting shared object
            response.headers = { ...response.headers, ...corsHeaders };
            await runtime.emit("milkio:httpResponse", { executeId, logger, path: http.path.string as string, http, headers: http.request.headers, context, success: false, reject, raise });
            // Run onFinally handlers even on error (important for raw routes where
            // the handler may have registered cleanup via context.onFinally before throwing)
            if (finales.length > 0) {
                for (const handler of finales) {
                    try { await handler(); } catch (e) { logger.error("An error occurred inside onFinally.", e); }
                }
            }
            if (hasOnLoggerSubmitting) await logger._.submit(context as any);
            if (anyEmitHandlers) runtime.runtime.request.delete(executeId);
            if (options.rawResponse) {
                return { __rawResponse: true, body: response.body, status: response.status, headers: response.headers } as any;
            }
            return new Response(response.body as BodyInit | null, response);
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
                const executeId = options.substring("CLOSE_STREAM:".length);
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
            for (const handler of finales) {
                try {
                    await handler();
                } catch (error) {
                    logger.error("An error occurred inside onFinally.", error);
                }
            }
            await logger._.submit(context as any);
            runtime.runtime.request.delete(options.executeId);
        };

        const context = { http: http, headers, routeType: routeSchema.type, reject, raise };

        try {
            if (routeSchema.type === "action") {
                const executed = await executer.__execute(routeSchema, {
                    createdExecuteId: options.executeId,
                    createdLogger: logger,
                    path: options.path,
                    headers,
                    context,
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
                    context,
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
            await logger._.submit(context as any);
            port.postMessage({ success: false, data: undefined, error: result, executeId: options.executeId, done: true });
        }
    };

    return {
        port,
        fetch,
        handleMessage,
    };
}
