export type MilkioStargateOptions = {
    baseUrl: string | (() => string) | (() => Promise<string>);
    timeout?: number;
    fetch?: typeof fetch;
    abort?: typeof AbortController;
};

export type Mixin<T, U> = U & Omit<T, keyof U>;

export type ExecuteOptions = {
    params?: Record<any, any>;
    headers?: Record<string, string>;
    timeout?: number;
    baseUrl?: string | (() => string) | (() => Promise<string>);
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

    type StargateEvents = {
        "milkio:executeBefore": { path: string; options: Mixin<ExecuteOptions, { headers: Record<string, string>; baseUrl: string }> };
        "milkio:fetchBefore": { path: string; options: Mixin<ExecuteOptions, { headers: Record<string, string>; baseUrl: string }>; body: string };
        "milkio:executeError": {
            path: string;
            options: Mixin<ExecuteOptions, { headers: Record<string, string>; baseUrl: string }>;
            error: Partial<Generated["rejectCode"]>;
            handleError: <K extends keyof Partial<Generated["rejectCode"]>>(error: any, key: K, handler: (error: Partial<Generated["rejectCode"][K]>) => boolean | Promise<boolean>) => Promise<void>;
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
        if (typeof baseUrl === "function") baseUrl = await baseUrl();
        if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);

        return baseUrl;
    };

    const baseUrl: Promise<string> = bootstrap();

    const stargate = {
        ...eventManager,
        options: stargateOptions,
        async execute<Path extends keyof Generated["routeSchema"]>(
            path: Path,
            options: Mixin<
                ExecuteOptions,
                {
                    params?: Generated["routeSchema"][Path]["types"]["params"];
                }
            >,
        ): Promise<
            Generated["routeSchema"][Path]["types"]["🥛"] extends boolean
            ? // action
            [Partial<Generated["rejectCode"]>, null, ExecuteResultsOption] | [null, Generated["routeSchema"][Path]["types"]["result"], ExecuteResultsOption]
            : // stream
            [Partial<Generated["rejectCode"]>, null, ExecuteResultsOption] | [null, AsyncGenerator<[Partial<Generated["rejectCode"]>, null] | [null, GeneratorGeneric<Generated["routeSchema"][Path]["types"]["result"]>], undefined>, ExecuteResultsOption]
        > {
            if (options.headers === undefined) options.headers = {};

            let url: string;
            if (options.baseUrl) {
                let baseUrl = options.baseUrl;
                if (typeof baseUrl === "function") baseUrl = await baseUrl();
                if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
                url = baseUrl + (path as string);
            } else {
                url = (await baseUrl) + (path as string);
            }

            if (!(path as string).endsWith("~")) {
                // action
                if (options.headers.Accept === undefined) options.headers.Accept = "application/json";
                if (options.headers["Content-Type"] === undefined) options.headers["Content-Type"] = "application/json";
                let result: { value: Record<any, any> };

                try {
                    await eventManager.emit("milkio:executeBefore", { path: path as string, options: options as any });

                    const body = JSON.stringify(options.params) ?? "";
                    await eventManager.emit("milkio:fetchBefore", { path: path as string, options: options as any, body });

                    // oxlint-disable-next-line no-async-promise-executor
                    const response = await new Promise<string>(async (resolve, reject) => {
                        const timeout = options?.timeout ?? options?.timeout ?? 6000;
                        const timer = setTimeout(() => {
                            reject([{ REQUEST_TIMEOUT: { timeout, message: `Execute timeout after ${timeout}ms.` } }, null]);
                        }, timeout);

                        try {
                            const value = await (await $fetch(url, { method: "POST", body, headers: options.headers })).text();
                            clearTimeout(timer);
                            resolve(value);
                        } catch (error) {
                            reject(error);
                        }
                    });
                    result = { value: reviveJSONParse(JSON.parse(response)) };
                } catch (error: any) {
                    if (error?.[0]?.REQUEST_TIMEOUT) {
                        await eventManager.emit("milkio:executeError", { handleError, path: path as string, options: options as any, error });
                        return error;
                    }
                    const errorPined = { REQUEST_FAIL: error };
                    await eventManager.emit("milkio:executeError", { handleError, path: path as string, options: options as any, error: errorPined });
                    return [errorPined, null, { executeId: "unknown" }];
                }
                if (result.value.success !== true) {
                    const error: any = {};
                    error[result.value.code] = result.value.reject ?? null;
                    await eventManager.emit("milkio:executeError", { handleError, path: path as string, options: options as any, error });
                    return [error, null, { executeId: "unknown" }];
                }

                return [null, result.value.data, { executeId: result.value.executeId }] as any;
            } else {
                // stream
                if (options.headers.Accept === undefined) options.headers.Accept = "text/event-stream";
                if (options.headers["Content-Type"] === undefined) options.headers["Content-Type"] = "application/json";

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
                    streamResultFetched.reject([{ REQUEST_TIMEOUT: { timeout, message: `Execute timeout after ${timeout}ms.` } }, null, { executeId: "unknown" }]);
                }, timeout);

                const onmessage = (event: EventSourceMessage) => {
                    if (event.data.startsWith("@")) {
                        try {
                            streamResult = reviveJSONParse(JSON.parse(event.data.slice(1)));
                            streamResultFetched.resolve(undefined);
                            clearTimeout(timer);
                        } catch (error) {
                            streamResultFetched.reject([{ REQUEST_FAIL: error }, null, { executeId: "unknown" }]);
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
                    curRequestController.signal.addEventListener("abort", () => {
                        iterator.return();
                    });
                    try {
                        await eventManager.emit("milkio:executeBefore", { path: path as string, options: options as any });

                        const body = JSON.stringify(options!.params) ?? "";
                        await eventManager.emit("milkio:fetchBefore", { path: path as string, options: options as any, body });

                        const response = await $fetch(url, {
                            method: "POST",
                            headers: options!.headers,
                            body,
                            signal: curRequestController.signal,
                        });

                        const contentType = response.headers.get("Content-Type");
                        if (!contentType?.startsWith("text/event-stream")) {
                            throw new Error(`Expected content-type to be ${"text/event-stream"}, Actual: ${contentType}`);
                        }

                        await getBytes(response.body!, getLines(getMessages(onmessage)));

                        await iterator.return();
                    } catch (err) {
                        if (!curRequestController.signal.aborted) curRequestController.abort();
                        const error = { REQUEST_FAIL: err };
                        await eventManager.emit("milkio:executeError", { handleError, path: path as string, options: options as any, error });
                        await iterator.throw(err);
                        streamResultFetched.reject([error, null, { executeId: "unknown" }]);
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
                                executeId: streamResult?.executeId ?? "",
                                fail: {
                                    code: "NETWORK_ERROR",
                                    message: "Network Error",
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
                    "Content-Type": "application/json",
                    Accept: "text/event-stream",
                };
                const params = {};

                const body = JSON.stringify(params) ?? "";
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
                    curRequestController.signal.addEventListener("abort", () => {
                        iterator.return();
                    });
                    try {
                        const response = await $fetch(`${baseUrl}/$subscribe`, {
                            method: "POST",
                            headers,
                            body,
                            signal: curRequestController.signal,
                        });

                        const contentType = response.headers.get("Content-Type");
                        if (!contentType?.startsWith("text/event-stream")) {
                            throw new Error(`Expected content-type to be ${"text/event-stream"}, Actual: ${contentType}`);
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
                const url = `${await baseUrl}/generate_204`;
                const timeout = stargateOptions?.timeout ?? options?.timeout ?? 6000;
                const startsTime = Date.now();
                const timer = setTimeout(() => {
                    const endsTime = Date.now();
                    resolve([{ connect: false, delay: endsTime - startsTime, error: { REQUEST_TIMEOUT: { timeout, message: `Execute timeout after ${timeout}ms.` } } }, null]);
                }, timeout);

                try {
                    const response = await $fetch(url, { method: "HEAD" });
                    const endsTime = Date.now();
                    clearTimeout(timer);
                    if (response.status !== 204) {
                        resolve([{ connect: false, delay: endsTime - startsTime, error: { REQUEST_FAIL: { response, status: response.status, message: "Status code not 204" } } }, null]);
                    }

                    resolve([null, { connect: true, delay: endsTime - startsTime, serverTimestamp: Number(response.headers.get("Content-Type")!.substring(17)) }]);
                } catch (error: any) {
                    const endsTime = Date.now();
                    return [{ connect: false, delay: endsTime - startsTime, error }, null];
                }
            });
        },
        $types: undefined as unknown as {
            generated: Generated,
            error: Generated["rejectCode"];
            params: {
                [Path in keyof Generated["routeSchema"]]: Generated["routeSchema"][Path]["types"]["params"]
            },
            results: {
                [Path in keyof Generated["routeSchema"]]: Generated["routeSchema"][Path]["types"]["🥛"] extends boolean
                ? // action
                Generated["routeSchema"][Path]["types"]["result"]
                : // stream
                AsyncGenerator<[Partial<Generated["rejectCode"]>, null] | [null, GeneratorGeneric<Generated["routeSchema"][Path]["types"]["result"]>], undefined>
            },
        },
    };

    return stargate;
}

function reviveJSONParse<T>(json: T): T {
    const isoDatePattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(Z|[+-]\d{2}:?\d{2})?$/;

    if (json instanceof Date) return json;
    if (Array.isArray(json)) {
        return json.map((item) => reviveJSONParse(item)) as any;
    }
    if (typeof json === "object" && json !== null) {
        return Object.entries(json).reduce((acc, [key, value]) => {
            acc[key as keyof T] = reviveJSONParse(value);
            return acc;
        }, {} as T);
    }
    if (typeof json === "string") {
        const match = json.match(isoDatePattern);
        if (match) {
            const normalizedDateString = match[2] ? `${match[1]}${match[2].replace(":", "")}` : `${match[1]}Z`;
            return new Date(normalizedDateString) as any;
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

export type FlattenKeys<T, Prefix extends string = ""> = {
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
                    // biome-ignore lint/suspicious/noFallthroughSwitchClause: <explanation>
                    case 13:
                        discardTrailingNewline = true;
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
                case "data":
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
        data: "",
    };
}

export function withResolvers<T = any>(): PromiseWithResolvers<T> {
    let resolve: PromiseWithResolvers<T>["resolve"];
    let reject: PromiseWithResolvers<T>["reject"];
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
}
