export type MilkioStargateOptions = {
    baseUrl: string | (() => string) | (() => Promise<string>);
    timeout?: number;
    fetch?: typeof fetch;
    abort?: typeof AbortController;
    cacheStorage?: CacheStorage;
    cacheEncryption?: boolean;
};

export type Mixin<T, U> = U & Omit<T, keyof U>;

export type CacheStrategy = 'off' | 'fallback' | 'throttle';

export type RetryStrategy = boolean | number;

export interface CacheStorage {
    get: (key: string) => Promise<{ data: any; timestamp: number } | null>;
    set: (key: string, data: any) => Promise<void>;
}

export type ExecuteOptions<T extends any> = {
    params?: Record<any, any>;
    headers?: Record<string, string>;
    timeout?: number;
    baseUrl?: string | (() => string) | (() => Promise<string>);
    cacheStrategy?: CacheStrategy;
    cacheThrottleMs?: number;
    onCacheHit?: (result: T) => void | Promise<void>;
    retryStrategy?: RetryStrategy;
};

export type ExecuteResultsOption = { executeId: string };

export type Ping =
    | [
        {
            connect: false;
            delay: number;
            error: any;
        },
        null,
    ]
    | [
        null,
        {
            connect: true;
            delay: number;
            serverTimestamp: number;
        },
    ];
export async function createStargate<Generated extends { routeSchema: any; rejectCode: any }>(stargateOptions: MilkioStargateOptions) {
    const $fetch = stargateOptions.fetch ?? fetch;
    const $abort = stargateOptions.abort ?? AbortController;

    // Detect if we can use Node.js http module for native HTTP transport
    // Only use in pure Node.js environment (not Bun, not Deno, not serverless)
    let nodeHttpRequest: any = null;
    let nodeHttpAgent: any = null;
    try {
        // Bun also supports node:http, but its fetch is already optimized
        // Only use native http when running in pure Node.js
        if (typeof process !== 'undefined' && typeof (Bun as any) === 'undefined') {
            const http = await import('node:http');
            nodeHttpRequest = http.request;
            nodeHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });
        }
    } catch {
        // Not in Node.js environment (Deno, browser, serverless, etc.)
    }

    // Native HTTP POST using Node.js http module (bypasses undici overhead)
    // Falls back to fetch in non-Node.js environments
    const nativeHttpPost = nodeHttpRequest
        ? (url: string, headers: Record<string, string>, body: string): Promise<string> => {
            return new Promise((resolve, reject) => {
                const parsedUrl = new URL(url);
                const options = {
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || 80,
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: 'POST',
                    headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
                    agent: nodeHttpAgent,
                };
                const req = nodeHttpRequest(options, (res: any) => {
                    let data = '';
                    res.on('data', (chunk: any) => { data += chunk; });
                    res.on('end', () => { resolve(data); });
                });
                req.on('error', reject);
                req.write(body);
                req.end();
            });
        }
        : null;

    type StargateEvents = {
        'milkio:executeBefore': { path: string; options: Mixin<ExecuteOptions<any>, { headers: Record<string, string>; baseUrl: string }> };
        'milkio:fetchBefore': { path: string; options: Mixin<ExecuteOptions<any>, { headers: Record<string, string>; baseUrl: string }>; body: string };
        'milkio:executeError': {
            path: string;
            options: Mixin<ExecuteOptions<any>, { headers: Record<string, string>; baseUrl: string }>;
            error: Partial<Generated['rejectCode']>;
            handleError: <K extends keyof Partial<Generated['rejectCode']>>(error: any, key: K, handler: (error: Partial<Generated['rejectCode'][K]>) => boolean | Promise<boolean>) => Promise<void>;
        };
    };

    const handleError: any = async (error: any, key: string, handler: (error: any) => boolean | Promise<boolean>) => {
        if (key in error) {
            const handled = await handler(error[key]);
            if (handled) delete error[key];
        }
    };

    const __initEventManager = () => {
        const handlers = new Map<(event: any) => void, string>();
        const indexed = new Map<string, Set<(event: any) => void>>();

        const eventManager = {
            on: <Key extends keyof StargateEvents, Handler extends (event: StargateEvents[Key]) => void>(key: Key, handler: Handler) => {
                handlers.set(handler, key as string);
                if (indexed.has(key as string) === false) {
                    indexed.set(key as string, new Set());
                }
                const set = indexed.get(key as string)!;
                set.add(handler);
                handlers.set(handler, key as string);

                return () => {
                    handlers.delete(handler);
                    set.delete(handler);
                };
            },
            off: <Key extends keyof StargateEvents, Handler extends (event: StargateEvents[Key]) => void>(key: Key, handler: Handler) => {
                const set = indexed.get(key as string);
                if (!set) return;
                handlers.delete(handler);
                set.delete(handler);
            },
            emit: async <Key extends keyof StargateEvents, Value extends StargateEvents[Key]>(key: Key, value: Value): Promise<void> => {
                const h = indexed.get(key as string);
                if (h) {
                    for (const handler of h) {
                        await handler(value);
                    }
                }
            },
        };

        return eventManager;
    };

    const eventManager = __initEventManager();

    const bootstrap = async () => {
        let baseUrl = stargateOptions.baseUrl;
        if (typeof baseUrl === 'function') baseUrl = await baseUrl();
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

        return baseUrl;
    };

    const baseUrlPromise: Promise<string> = bootstrap();
    // Cache resolved baseUrl to avoid await overhead on repeated calls
    let resolvedBaseUrl: string | null = null;
    // Cache URL for last path to avoid string concatenation per request
    let cachedUrlPath: string | null = null;
    let cachedUrl: string | null = null;

    const stargate = {
        ...eventManager,
        options: stargateOptions,
        async execute<Path extends keyof Generated['routeSchema']>(
            path: Path,
            options: Mixin<
                ExecuteOptions<Generated['routeSchema'][Path]['types']['result']>,
                {
                    params?: Generated['routeSchema'][Path]['types']['params'];
                }
            >,
        ): Promise<
            Generated['routeSchema'][Path]['types']['🥛'] extends boolean
            ? // action
            [Partial<Generated['rejectCode']>, null, ExecuteResultsOption] | [null, Generated['routeSchema'][Path]['types']['result'], ExecuteResultsOption]
            : // stream
            [Partial<Generated['rejectCode']>, null, ExecuteResultsOption] | [null, AsyncGenerator<[Partial<Generated['rejectCode']>, null] | [null, GeneratorGeneric<Generated['routeSchema'][Path]['types']['result']>], undefined>, ExecuteResultsOption]
        > {
            if (options.headers === undefined) options.headers = {};

            let url: string;
            if (options.baseUrl) {
                let baseUrl = options.baseUrl;
                if (typeof baseUrl === 'function') baseUrl = await baseUrl();
                if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
                url = baseUrl + (path as string);
            } else {
                if (!resolvedBaseUrl) resolvedBaseUrl = await baseUrlPromise;
                // Cache URL for repeated path to avoid string concatenation
                if (path === cachedUrlPath && cachedUrl !== null) {
                    url = cachedUrl;
                } else {
                    url = resolvedBaseUrl + (path as string);
                    cachedUrlPath = path as string;
                    cachedUrl = url;
                }
            }

            if (!(path as string).endsWith('~')) {
                // action
                // Set default headers only if not already present
                const h = options.headers;
                if (h.Accept === undefined) h.Accept = 'application/json';
                if (h['Content-Type'] === undefined) h['Content-Type'] = 'application/json';

                const cacheStrategy = options.cacheStrategy ?? 'off';
                let retryCount = 0;
                if (options.retryStrategy === true || options.retryStrategy === 2) {
                    retryCount = 2;
                } else if (typeof options.retryStrategy === 'number' && options.retryStrategy > 0) {
                    retryCount = options.retryStrategy;
                }

                // Fast path: no cache, no retry
                if (cacheStrategy === 'off' && retryCount === 0) {
                    try {
                        await eventManager.emit('milkio:executeBefore', { path: path as string, options: options as any });
                        const body = JSON.stringify(options.params) ?? '';
                        await eventManager.emit('milkio:fetchBefore', { path: path as string, options: options as any, body });
                        let text: string;
                        if (nativeHttpPost) {
                            // Use Node.js native http module for POST (bypasses undici overhead)
                            text = await nativeHttpPost(url, options.headers, body);
                        } else {
                            const response = await $fetch(url, { method: 'POST', body, headers: options.headers });
                            text = await response.text();
                        }
                        const parsed = reviveJSONParse(JSON.parse(text));
                        if (parsed.success !== true) {
                            const err: any = {};
                            err[parsed.code] = parsed.reject ?? null;
                            return [err, null, { executeId: parsed.executeId }];
                        }
                        return [null, parsed.data, { executeId: parsed.executeId }];
                    } catch (error: any) {
                        if (error?.[0]?.REQUEST_TIMEOUT) {
                            return [error, null, { executeId: '' }];
                        }
                        const errorPined = { REQUEST_FAIL: error };
                        return [errorPined, null, { executeId: 'unknown' }];
                    }
                }

                const cacheThrottleMs = options.cacheThrottleMs ?? 0;
                const cacheKey = generateCacheKey(path as string, options.params);

                let cacheStorage = stargateOptions.cacheStorage;
                if (cacheStrategy !== 'off' && !cacheStorage) {
                    cacheStorage = await createDefaultCacheStorage({ encryption: stargateOptions.cacheEncryption });
                }

                if (cacheStrategy !== 'off' && cacheStorage && options.onCacheHit) {
                    const cached = await cacheStorage.get(cacheKey);
                    if (cached) {
                        try {
                            await options.onCacheHit(cached.data);
                        } catch {
                            // ignore onCacheHit errors
                        }
                    }
                }

                if (cacheStrategy === 'throttle' && cacheStorage) {
                    const cached = await cacheStorage.get(cacheKey);
                    if (cached && Date.now() - cached.timestamp < cacheThrottleMs) {
                        return [null, cached.data, { executeId: 'cached' }] as any;
                    }
                }

                await eventManager.emit('milkio:executeBefore', { path: path as string, options: options as any });
                const body = JSON.stringify(options.params) ?? '';
                await eventManager.emit('milkio:fetchBefore', { path: path as string, options: options as any, body });

                const executeRequest = async (isRetry: boolean): Promise<{ result: { value: Record<any, any> } | null; error: any; isNetworkError: boolean }> => {
                    try {
                        const response = await $fetch(url, { method: 'POST', body, headers: options.headers });
                        const text = await response.text();
                        const parsed = JSON.parse(text);
                        return { result: { value: parsed }, error: null, isNetworkError: false };
                    } catch (error: any) {
                        const isNetworkError = !error?.[0]?.REQUEST_TIMEOUT;
                        return { result: null, error, isNetworkError };
                    }
                };

                let { result, error, isNetworkError } = await executeRequest(false);

                for (let retryIndex = 0; retryIndex < retryCount && error && isNetworkError; retryIndex++) {
                    if (retryIndex > 0) {
                        await new Promise((resolve) => setTimeout(resolve, 500));
                    }
                    const retryResult = await executeRequest(true);
                    result = retryResult.result;
                    error = retryResult.error;
                    isNetworkError = retryResult.isNetworkError;
                }

                if (error) {
                    if (error?.[0]?.REQUEST_TIMEOUT) {
                        await eventManager.emit('milkio:executeError', { handleError, path: path as string, options: options as any, error });
                        return error;
                    }

                    if (cacheStrategy !== 'off' && cacheStorage && isNetworkError) {
                        const cached = await cacheStorage.get(cacheKey);
                        if (cached) {
                            return [null, cached.data, { executeId: 'cached' }] as any;
                        }
                    }

                    const errorPined = { REQUEST_FAIL: error };
                    await eventManager.emit('milkio:executeError', { handleError, path: path as string, options: options as any, error: errorPined });
                    return [errorPined, null, { executeId: 'unknown' }];
                }

                if (result!.value.success !== true) {
                    const err: any = {};
                    err[result!.value.code] = result!.value.reject ?? null;
                    await eventManager.emit('milkio:executeError', { handleError, path: path as string, options: options as any, error: err });
                    return [err, null, { executeId: result!.value.executeId }];
                }

                if (cacheStrategy !== 'off' && cacheStorage) {
                    await cacheStorage.set(cacheKey, result!.value.data);
                }

                return [null, result!.value.data, { executeId: result!.value.executeId }] as any;
            } else {
                // stream
                options.cacheStrategy = 'off';
                options.onCacheHit = undefined;
                options.cacheThrottleMs = undefined;

                if (options.headers.Accept === undefined) options.headers.Accept = 'text/event-stream';
                if (options.headers['Content-Type'] === undefined) options.headers['Content-Type'] = 'application/json';

                const stacks: Map<
                    number,
                    {
                        done: boolean;
                        promise: Promise<IteratorResult<any>>;
                        resolve: (value: IteratorResult<any>) => void;
                        reject: (reason: any) => void;
                    }
                > = new Map();
                let stacksIndex = 0;
                let iteratorIndex = 0;
                let streamResult: any;
                const streamResultFetched = withResolvers<undefined>();

                const timeout = stargateOptions?.timeout ?? options?.timeout ?? 6000;
                const timer = setTimeout(() => {
                    streamResultFetched.reject([{ REQUEST_TIMEOUT: { timeout, message: `Execute timeout after ${timeout}ms.` } }, null, { executeId: 'unknown' }]);
                }, timeout);

                const onmessage = (event: EventSourceMessage) => {
                    if (event.data.startsWith('@')) {
                        try {
                            streamResult = reviveJSONParse(JSON.parse(event.data.slice(1)));
                            streamResultFetched.resolve(undefined);
                            clearTimeout(timer);
                        } catch (error) {
                            streamResultFetched.reject([{ REQUEST_FAIL: error }, null, { executeId: 'unknown' }]);
                            clearTimeout(timer);
                        }
                    } else {
                        const index = ++stacksIndex;
                        if (stacks.has(index)) {
                            const stack = stacks.get(index);
                            stack!.done = true;
                            stack!.resolve({ done: false, value: reviveJSONParse(JSON.parse(event.data)) });
                        } else {
                            const stack = withResolvers<IteratorResult<any>>();
                            stack.resolve({ done: false, value: reviveJSONParse(JSON.parse(event.data)) });
                            stacks.set(index, { ...stack, done: false });
                        }
                    }
                };

                let curRequestController: AbortController;

                async function create() {
                    curRequestController = new $abort();
                    curRequestController.signal.addEventListener('abort', () => {
                        iterator.return();
                    });
                    try {
                        await eventManager.emit('milkio:executeBefore', { path: path as string, options: options as any });

                        const body = JSON.stringify(options!.params) ?? '';
                        await eventManager.emit('milkio:fetchBefore', { path: path as string, options: options as any, body });

                        const response = await $fetch(url, {
                            method: 'POST',
                            headers: options!.headers,
                            body,
                            signal: curRequestController.signal,
                        });

                        const contentType = response.headers.get('Content-Type');
                        if (!contentType?.startsWith('text/event-stream')) {
                            throw new Error(`Expected content-type to be ${'text/event-stream'}, Actual: ${contentType}`);
                        }

                        await getBytes(response.body!, getLines(getMessages(onmessage)));

                        await iterator.return();
                    } catch (err) {
                        if (!curRequestController.signal.aborted) curRequestController.abort();
                        const error = { REQUEST_FAIL: err };
                        await eventManager.emit('milkio:executeError', { handleError, path: path as string, options: options as any, error });
                        await iterator.throw(err);
                        streamResultFetched.reject([error, null, { executeId: 'unknown' }]);
                    }
                }

                void create();

                const iterator = {
                    ...({
                        next(): Promise<IteratorResult<unknown>> {
                            const index = ++iteratorIndex;
                            if (stacks.has(index - 2)) stacks.delete(index - 2);
                            if (!stacks.has(index) && !curRequestController.signal.aborted) {
                                const stack = withResolvers<IteratorResult<any>>();
                                stacks.set(index, { ...stack, done: false });
                                return stack.promise;
                            }
                            if (!stacks.has(index) && curRequestController.signal.aborted) {
                                const stack = withResolvers<IteratorResult<any>>();
                                stack.resolve({ done: true, value: undefined });
                                return stack.promise;
                            }
                            return stacks.get(index)!.promise;
                        },
                        async return(): Promise<IteratorResult<void>> {
                            if (!curRequestController.signal.aborted) curRequestController.abort();
                            for (const [_, iterator] of stacks) iterator.resolve({ done: true, value: undefined });
                            return { done: true, value: undefined };
                        },
                        async throw(err: any): Promise<IteratorResult<void>> {
                            streamResult = {
                                success: false,
                                executeId: streamResult?.executeId ?? '',
                                fail: {
                                    code: 'NETWORK_ERROR',
                                    message: 'Network Error',
                                    fromClient: true,
                                    data: err,
                                },
                            };
                            for (const [_index, stack] of stacks) {
                                if (stack.done) continue;
                                stack.done = true;
                                stack.resolve({ done: true, value: undefined });
                            }
                            if (!curRequestController.signal.aborted) curRequestController.abort();
                            for (const [_, iterator] of stacks) iterator.resolve({ done: true, value: undefined });
                            return { done: true, value: undefined };
                        },
                    } satisfies AsyncIterator<unknown>),
                    [Symbol.asyncIterator]() {
                        return this;
                    },
                };

                try {
                    await streamResultFetched.promise;
                    return [null, iterator, { executeId: streamResult.executeId }] as any;
                } catch (error) {
                    return error as any;
                }
            }
        },
        __cookbook: {
            subscribe: async (baseUrl: string) => {
                const headers = {
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream',
                };
                const params = {};

                const body = JSON.stringify(params) ?? '';
                const stacks: Map<
                    number,
                    {
                        done: boolean;
                        promise: Promise<IteratorResult<any>>;
                        resolve: (value: IteratorResult<any>) => void;
                        reject: (reason: any) => void;
                    }
                > = new Map();
                let stacksIndex = 0;
                let iteratorIndex = 0;

                const onmessage = (event: EventSourceMessage) => {
                    const index = ++stacksIndex;
                    if (stacks.has(index)) {
                        const stack = stacks.get(index);
                        stack!.resolve({ done: false, value: reviveJSONParse(JSON.parse(event.data)) });
                    } else {
                        const stack = withResolvers<IteratorResult<any>>();
                        stack.resolve({ done: false, value: reviveJSONParse(JSON.parse(event.data)) });
                        stacks.set(index, { ...stack, done: false });
                    }
                };

                let curRequestController: AbortController;

                async function create() {
                    curRequestController = new $abort();
                    curRequestController.signal.addEventListener('abort', () => {
                        iterator.return();
                    });
                    try {
                        const response = await $fetch(`${baseUrl}/$subscribe`, {
                            method: 'POST',
                            headers,
                            body,
                            signal: curRequestController.signal,
                        });

                        const contentType = response.headers.get('Content-Type');
                        if (!contentType?.startsWith('text/event-stream')) {
                            throw new Error(`Expected content-type to be ${'text/event-stream'}, Actual: ${contentType}`);
                        }

                        await getBytes(response.body!, getLines(getMessages(onmessage)));

                        await iterator.return();
                    } catch (err) {
                        if (!curRequestController.signal.aborted) curRequestController.abort();
                        await iterator.throw(err);
                    }
                }

                void create();

                const iterator = {
                    ...({
                        next(): Promise<IteratorResult<unknown>> {
                            const index = ++iteratorIndex;
                            if (stacks.has(index - 2)) stacks.delete(index - 2);
                            if (!stacks.has(index) && !curRequestController.signal.aborted) {
                                const stack = withResolvers<IteratorResult<any>>();
                                stacks.set(index, { ...stack, done: false });
                                return stack.promise;
                            }
                            if (!stacks.has(index) && curRequestController.signal.aborted) {
                                const stack = withResolvers<IteratorResult<any>>();
                                stack.resolve({ done: true, value: undefined });
                                return stack.promise;
                            }
                            return stacks.get(index)!.promise;
                        },
                        async return(): Promise<IteratorResult<void>> {
                            if (!curRequestController.signal.aborted) curRequestController.abort();
                            for (const [_, iterator] of stacks) iterator.resolve({ done: true, value: undefined });
                            return { done: true, value: undefined };
                        },
                        async throw(err: any): Promise<IteratorResult<void>> {
                            if (!curRequestController.signal.aborted) curRequestController.abort();
                            for (const [_, iterator] of stacks) iterator.resolve({ done: true, value: undefined });
                            return { done: true, value: undefined };
                        },
                    } satisfies AsyncIterator<unknown>),
                    [Symbol.asyncIterator]() {
                        return this;
                    },
                };

                try {
                    return iterator;
                } catch (error) {
                    return error as any;
                }
            },
        },
        async ping(options?: { timeout?: number }): Promise<Ping> {
            // oxlint-disable-next-line no-async-promise-executor
            return await new Promise<Ping>(async (resolve) => {
                const url = `${await baseUrlPromise}/generate_204`;
                const timeout = stargateOptions?.timeout ?? options?.timeout ?? 6000;
                const startsTime = Date.now();
                const timer = setTimeout(() => {
                    const endsTime = Date.now();
                    resolve([{ connect: false, delay: endsTime - startsTime, error: { REQUEST_TIMEOUT: { timeout, message: `Execute timeout after ${timeout}ms.` } } }, null]);
                }, timeout);

                try {
                    const response = await $fetch(url, { method: 'HEAD' });
                    const endsTime = Date.now();
                    clearTimeout(timer);
                    if (response.status !== 204) {
                        resolve([{ connect: false, delay: endsTime - startsTime, error: { REQUEST_FAIL: { response, status: response.status, message: 'Status code not 204' } } }, null]);
                    }

                    resolve([null, { connect: true, delay: endsTime - startsTime, serverTimestamp: Number(response.headers.get('Content-Type')!.substring(17)) }]);
                } catch (error: any) {
                    const endsTime = Date.now();
                    return [{ connect: false, delay: endsTime - startsTime, error }, null];
                }
            });
        },
        $types: undefined as unknown as {
            generated: Generated;
            error: Generated['rejectCode'];
            params: {
                [Path in keyof Generated['routeSchema']]: Generated['routeSchema'][Path]['types']['params'];
            };
            results: {
                [Path in keyof Generated['routeSchema']]: Generated['routeSchema'][Path]['types']['🥛'] extends boolean
                ? // action
                Generated['routeSchema'][Path]['types']['result']
                : // stream
                AsyncGenerator<[Partial<Generated['rejectCode']>, null] | [null, GeneratorGeneric<Generated['routeSchema'][Path]['types']['result']>], undefined>;
            };
        },
    };

    return stargate;
}

const isoDatePattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(Z|[+-]\d{2}:?\d{2})?$/;

export function reviveJSONParse<T>(json: T): T {
    if (json === null || json === undefined) return json;
    const type = typeof json;
    if (type === 'object') {
        if (json instanceof Date) return json;
        if (Array.isArray(json)) {
            const len = json.length;
            for (let i = 0; i < len; i++) {
                const result = reviveJSONParse(json[i]);
                if (result !== json[i]) json[i] = result;
            }
            return json;
        }
        const keys = Object.keys(json as object);
        const obj = json as Record<string, unknown>;
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = obj[key];
            const result = reviveJSONParse(value);
            if (result !== value) obj[key] = result;
        }
        return json;
    }
    if (type === 'string') {
        const str = json as unknown as string;
        // Quick reject: ISO date strings must start with a digit and contain 'T'
        const len = str.length;
        if (len >= 20 && len <= 32 && str.charCodeAt(0) >= 0x30 && str.charCodeAt(0) <= 0x39 && str.indexOf('T') !== -1) {
            const match = str.match(isoDatePattern);
            if (match !== null) {
                if (match[2]) {
                    const colonPos = match[2].charCodeAt(3) === 58 ? match[1].length + 3 : -1;
                    if (colonPos >= 0) {
                        return new Date(str.substring(0, colonPos) + str.substring(colonPos + 1)) as any;
                    }
                    return new Date(str) as any;
                }
                return new Date(match[1] + 'Z') as any;
            }
        }
    }
    return json;
}

export interface ExecuteStreamOptions {
    headers?: Record<string, string>;
    timeout?: number;
}

export interface ApiSchemaExtend {
    apiValidator: {
        generatedAt: number;
        validate: Record<any, any>;
    };
    apiMethodsSchema: Record<any, any>;
    apiMethodsTypeSchema: Record<any, any>;
    apiTestsSchema: Record<any, any>;
}

export type FailCodeExtend = Record<any, (...args: Array<any>) => any>;

export type BootstrapMiddleware = (data: { storage: ClientStorage }) => Promise<void> | void;
export type BeforeExecuteMiddleware = (data: { path: string; params: any; headers: Record<string, string>; storage: ClientStorage }) => Promise<void> | void;
export type AfterExecuteMiddleware = (data: { path: string; result: { value: any }; storage: ClientStorage }) => Promise<void> | void;

export interface MiddlewareOptions {
    bootstrap?: BootstrapMiddleware;
    beforeExecute?: BeforeExecuteMiddleware;
    afterExecute?: AfterExecuteMiddleware;
}

export interface ClientStorage {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
}

export interface ExecuteResultSuccess<Result> {
    executeId: string;
    success: true;
    data: Result;
}

export type GeneratorGeneric<T> = T extends AsyncGenerator<infer I> ? I : never;

export type FlattenKeys<T, Prefix extends string = ''> = {
    [K in keyof T]: T[K] extends object ? FlattenKeys<T[K], `${Prefix}${Exclude<K, symbol>}.`> : `$input.${Prefix}${Exclude<K, symbol>}`;
}[keyof T];

// *** This part of the code is based on `@microsoft/fetch-event-source` rewrite, thanks to the work of Microsoft *** //
// *** https://github.com/Azure/fetch-event-source/blob/main/src/parse.ts                                         *** //

/**
 * Represents a message sent in an event stream
 * https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format
 */
export interface EventSourceMessage {
    data: string;
}

/**
 * Converts a ReadableStream into a callback pattern.
 * @param stream The input ReadableStream.
 * @param onChunk A function that will be called on each new byte chunk in the stream.
 * @returns {Promise<void>} A promise that will be resolved when the stream closes.
 */
export async function getBytes(stream: ReadableStream<Uint8Array>, onChunk: (arr: Uint8Array) => void) {
    const reader = stream.getReader();
    let result: ReadableStreamReadResult<Uint8Array>;
    // @ts-ignore
    while (!(result = await reader.read()).done) {
        onChunk(result.value);
    }
}

/**
 * Parses arbitary byte chunks into EventSource line buffers.
 * Each line should be of the format "field: value" and ends with \r, \n, or \r\n.
 * @param onLine A function that will be called on each new EventSource line.
 * @returns A function that should be called for each incoming byte chunk.
 */
export function getLines(onLine: (line: Uint8Array, fieldLength: number) => void) {
    let buffer: Uint8Array | undefined;
    let position: number; // current read position
    let fieldLength: number; // length of the `field` portion of the line
    let discardTrailingNewline = false;

    // return a function that can process each incoming byte chunk:
    return function onChunk(arr: Uint8Array) {
        if (buffer === undefined) {
            buffer = arr;
            position = 0;
            fieldLength = -1;
        } else {
            // we're still parsing the old line. Append the new bytes into buffer:
            buffer = concat(buffer, arr);
        }

        const bufLength = buffer.length;
        let lineStart = 0; // index where the current line starts
        while (position < bufLength) {
            if (discardTrailingNewline) {
                if (buffer[position] === 10) {
                    lineStart = ++position; // skip to next char
                }

                discardTrailingNewline = false;
            }

            // start looking forward till the end of line:
            let lineEnd = -1; // index of the \r or \n char
            for (; position < bufLength && lineEnd === -1; ++position) {
                switch (buffer[position]) {
                    case 58:
                        if (fieldLength === -1) {
                            // first colon in line
                            fieldLength = position - lineStart;
                        }
                        break;
                    case 13: {
                        discardTrailingNewline = true;
                        lineEnd = position;
                        break;
                    }
                    case 10:
                        lineEnd = position;
                        break;
                }
            }

            if (lineEnd === -1) {
                // We reached the end of the buffer but the line hasn't ended.
                // Wait for the next arr and then continue parsing:
                break;
            }

            // we've reached the line end, send it out:
            onLine(buffer.subarray(lineStart, lineEnd), fieldLength);
            lineStart = position; // we're now on the next line
            fieldLength = -1;
        }

        if (lineStart === bufLength) {
            buffer = undefined; // we've finished reading it
        } else if (lineStart !== 0) {
            // Create a new view into buffer beginning at lineStart so we don't
            // need to copy over the previous lines when we get the new arr:
            buffer = buffer.subarray(lineStart);
            position -= lineStart;
        }
    };
}

/**
 * Parses line buffers into EventSourceMessages.
 * @param onId A function that will be called on each `id` field.
 * @param onRetry A function that will be called on each `retry` field.
 * @param onMessage A function that will be called on each message.
 * @returns A function that should be called for each incoming line buffer.
 */
export function getMessages(onMessage?: (msg: EventSourceMessage) => void) {
    let message = newMessage();
    const decoder = new TextDecoder();

    // return a function that can process each incoming line buffer:
    return function onLine(line: Uint8Array, fieldLength: number) {
        if (line.length === 0) {
            // empty line denotes end of message. Trigger the callback and start a new message:
            onMessage?.(message);
            message = newMessage();
        } else if (fieldLength > 0) {
            // exclude comments and lines with no values
            // line is of format "<field>:<value>" or "<field>: <value>"
            // https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
            const field = decoder.decode(line.subarray(0, fieldLength));
            const valueOffset = fieldLength + (line[fieldLength + 1] === 32 ? 2 : 1);
            const value = decoder.decode(line.subarray(valueOffset));

            switch (field) {
                case 'data':
                    // if this message already has data, append the new value to the old.
                    // otherwise, just set to the new value:
                    message.data = message.data ? `${message.data}\n${value}` : value; // otherwise,
                    break;
            }
        }
    };
}

function concat(a: Uint8Array, b: Uint8Array) {
    const res = new Uint8Array(a.length + b.length);
    res.set(a);
    res.set(b, a.length);
    return res;
}

function newMessage(): EventSourceMessage {
    return {
        data: '',
    };
}

export function withResolvers<T = any>(): PromiseWithResolvers<T> {
    let resolve: PromiseWithResolvers<T>['resolve'];
    let reject: PromiseWithResolvers<T>['reject'];
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
}

const DB_NAME = 'Stargate';
const STORE_NAME = 'caches';
let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

export async function createDefaultCacheStorage(options?: { encryption?: boolean; encryptionKey?: string }): Promise<CacheStorage> {
    await openDB();

    let encryptionKey: CryptoKey | null = null;
    const counter = new Uint8Array(16);

    if (options?.encryption) {
        const keyString = options.encryptionKey ?? DB_NAME;
        new TextEncoder().encode(keyString).forEach((byte, i) => {
            if (i < 16) counter[i] = byte;
        });

        const encoder = new TextEncoder();
        const keyData = encoder.encode(keyString);
        const importedKey = await crypto.subtle.importKey('raw', keyData, { name: 'PBKDF2' }, false, ['deriveKey']);

        encryptionKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode('milkio-stargate-cache'),
                iterations: 100000,
                hash: 'SHA-256',
            },
            importedKey,
            { name: 'AES-CTR', length: 256 },
            false,
            ['encrypt', 'decrypt'],
        );
    }

    const encryptData = async (data: any): Promise<Uint8Array> => {
        if (!encryptionKey) return data;

        const jsonString = JSON.stringify(data);
        const encoder = new TextEncoder();
        const dataBytes = encoder.encode(jsonString);

        const encryptedArrayBuffer = await crypto.subtle.encrypt(
            {
                name: 'AES-CTR',
                counter: counter,
                length: 64,
            },
            encryptionKey!,
            dataBytes,
        );

        return new Uint8Array(encryptedArrayBuffer);
    };

    const decryptData = async (encryptedData: ArrayBuffer | Uint8Array): Promise<any> => {
        if (!encryptionKey || !encryptedData) return encryptedData;

        const arrayBuffer = encryptedData instanceof Uint8Array ? (encryptedData.buffer as ArrayBuffer) : encryptedData;

        const decryptedBytes = await crypto.subtle.decrypt(
            {
                name: 'AES-CTR',
                counter: counter,
                length: 64,
            },
            encryptionKey!,
            arrayBuffer,
        );

        const decoder = new TextDecoder();
        const jsonString = decoder.decode(decryptedBytes);
        return reviveJSONParse(JSON.parse(jsonString));
    };

    return {
        async get(key: string): Promise<{ data: any; timestamp: number } | null> {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);
                request.onerror = () => reject(request.error);
                request.onsuccess = async () => {
                    const result = request.result;
                    if (!result) {
                        resolve(null);
                        return;
                    }

                    if (options?.encryption && (result.data instanceof ArrayBuffer || result.data instanceof Uint8Array)) {
                        const decryptedData = await decryptData(result.data);
                        resolve({ data: decryptedData, timestamp: result.timestamp });
                        return;
                    }

                    resolve(result ?? null);
                };
            });
        },
        async set(key: string, data: any): Promise<void> {
            const db = await openDB();
            let dataToStore: any = data;

            if (options?.encryption) {
                dataToStore = await encryptData(data);
            }

            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put({ data: dataToStore, timestamp: Date.now() }, key);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        },
    };
}

function generateCacheKey(path: string, params: any): string {
    return `${path}:${JSON.stringify(params ?? {})}`;
}
