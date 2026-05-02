import { __createId } from "./utils/create-id.ts";

export type MilkioStargateOptions = {
    port: {
        postMessage: (data: any) => void;
        addEventListener: (event: "message", callback: (event: { data: any }) => void) => void;
        removeEventListener: (event: "message", callback: (event: { data: any }) => void) => void;
    };
    cacheStorage?: CacheStorage;
    cacheEncryption?: boolean;
    onLog?: (level: string, args: any[]) => void;
};

export type Mixin<T, U> = U & Omit<T, keyof U>;

export type CacheStrategy = 'off' | 'fallback' | 'throttle';

export type RetryStrategy = boolean | number;

export interface CacheStorage {
    get: (key: string) => Promise<{ data: any; timestamp: number } | null>;
    set: (key: string, data: any) => Promise<void>;
}

export type ExecuteOptions<T extends any = any> = {
    params?: Record<any, any>;
    headers?: Record<string, string>;
    cacheStrategy?: CacheStrategy;
    cacheThrottleMs?: number;
    onCacheHit?: (result: T) => void | Promise<void>;
    retryStrategy?: RetryStrategy;
};

export type ExecuteResultsOption = { executeId: string };

export type GeneratorGeneric<T> = T extends AsyncGenerator<infer I> ? I : never;

export async function createStargateWorker<Generated extends { routeSchema: any; rejectCode: any }>(stargateOptions: MilkioStargateOptions) {
    const executeIds = new Set<string>();
    const connect = new Promise((resolve) => {
        const handler = (event: { data: any }) => {
            if (event.data !== "PONG") return;
            clearInterval(timer);
            stargateOptions.port.removeEventListener("message", handler);
            resolve(true);
        };
        stargateOptions.port.addEventListener("message", handler);
        stargateOptions.port.postMessage("PING");
        const timer = setInterval(() => stargateOptions.port.postMessage("PING"), 42);
    });
    const logHandler = (event: { data: any }) => {
        if (typeof event.data !== "object" || !event.data.__milkio_log) return;
        const { level, args } = event.data.__milkio_log;
        const parsedArgs = JSON.parse(args);
        if (stargateOptions.onLog) {
            stargateOptions.onLog(level, parsedArgs);
        } else {
            const consoleFn = (console as any)[level] ?? console.log;
            consoleFn(...parsedArgs);
        }
    };
    stargateOptions.port.addEventListener("message", logHandler);

    const stargate = {
        close() {
            stargateOptions.port.removeEventListener("message", logHandler);
            for (const executeId of executeIds) {
                stargateOptions.port.postMessage(`CLOSE_STREAM:${executeId}`);
            }
            stargateOptions.port.postMessage("CLOSED");
        },
        async execute<Path extends keyof Generated["routeSchema"]>(
            path: Path,
            options: Mixin<
                ExecuteOptions<Generated["routeSchema"][Path]["types"]["result"]>,
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
            // oxlint-disable-next-line no-async-promise-executor
            return new Promise(async (resolve) => {
                await connect;

                if (!(path as string).endsWith("~")) {
                    // action
                    const cacheStrategy = options?.cacheStrategy ?? 'off';
                    let retryCount = 0;
                    if (options?.retryStrategy === true || options?.retryStrategy === 2) {
                        retryCount = 2;
                    } else if (typeof options?.retryStrategy === 'number' && options?.retryStrategy > 0) {
                        retryCount = options?.retryStrategy;
                    }
                    const cacheThrottleMs = options?.cacheThrottleMs ?? 0;
                    const cacheKey = generateCacheKey(path as string, options?.params);

                    let cacheStorage = stargateOptions.cacheStorage;
                    if (cacheStrategy !== 'off' && !cacheStorage) {
                        cacheStorage = await createDefaultCacheStorage({ encryption: stargateOptions.cacheEncryption });
                    }

                    if (cacheStrategy !== 'off' && cacheStorage && options?.onCacheHit) {
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
                            return resolve([null, cached.data, { executeId: 'cached' }] as any);
                        }
                    }

                    const executeRequest = (): Promise<[any, any, ExecuteResultsOption]> => {
                        return new Promise((reqResolve) => {
                            const reqExecuteId = __createId();
                            executeIds.add(reqExecuteId);
                            const handler = (event: { data: any }) => {
                                if (typeof event.data !== "object") return;
                                if (event.data.executeId !== reqExecuteId) return;
                                executeIds.delete(reqExecuteId);
                                stargateOptions.port.removeEventListener("message", handler);
                                if (!event.data.success) {
                                    const error: any = {};
                                    error[event.data.error.code] = event.data.error.reject;
                                    reqResolve([error, null, { executeId: reqExecuteId }]);
                                } else {
                                    reqResolve([null, event.data.data, { executeId: reqExecuteId }]);
                                }
                            };
                            stargateOptions.port.addEventListener("message", handler);
                            stargateOptions.port.postMessage({
                                executeId: reqExecuteId,
                                path,
                                params: options?.params,
                                headers: options?.headers,
                            });
                        });
                    };

                    let [error, result, resultOption] = await executeRequest();

                    for (let retryIndex = 0; retryIndex < retryCount && error; retryIndex++) {
                        if (retryIndex > 0) {
                            await new Promise((r) => setTimeout(r, 500));
                        }
                        [error, result, resultOption] = await executeRequest();
                    }

                    if (error) {
                        if (cacheStrategy !== 'off' && cacheStorage) {
                            const cached = await cacheStorage.get(cacheKey);
                            if (cached) {
                                return resolve([null, cached.data, { executeId: 'cached' }] as any);
                            }
                        }
                        return resolve([error, null, resultOption]);
                    }

                    if (cacheStrategy !== 'off' && cacheStorage) {
                        await cacheStorage.set(cacheKey, result);
                    }

                    resolve([null, result, resultOption] as any);
                } else {
                    // stream
                    const executeId = __createId();
                    executeIds.add(executeId);

                    let flow: ReturnType<typeof createFlow> | undefined;
                    const handler = (event: { data: any }) => {
                        if (typeof event.data !== "object") return;
                        if (event.data.executeId !== executeId) return;
                        if (!flow) {
                            flow = createFlow(stargateOptions, executeId);
                            if (!event.data.success) {
                                const error: any = {};
                                error[event.data.error.code] = event.data.error.reject;
                                resolve([error, null, { executeId }]);
                            }
                            if (event.data.success) resolve([null, flow, { executeId }] as any);
                        } else {
                            if (event.data.done) {
                                stargateOptions.port.removeEventListener("message", handler);
                                executeIds.delete(executeId);
                                if (event.data.success) flow.return(undefined, true);
                                else flow.throw(event.data.data?.at(0), true);
                            } else if (!event.data.success) {
                                stargateOptions.port.removeEventListener("message", handler);
                                executeIds.delete(executeId);
                                flow.throw(event.data.data, true);
                            } else if (event.data.success) flow.emit(event.data.data);
                        }
                    };
                    stargateOptions.port.addEventListener("message", handler);
                    stargateOptions.port.postMessage({
                        executeId,
                        path,
                        params: options?.params,
                        headers: options?.headers,
                    });
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

export type MilkioFlow<T, TReturn = any, TNext = any> = {
    emit: (flow: T) => void;
    [Symbol.asyncIterator]: () => MilkioFlow<T>;
    next(...[value]: [] | [TNext]): Promise<IteratorResult<T, TReturn>>;
    return(data: undefined, disablePostCloseMessage?: true): Promise<IteratorResult<T, TReturn>>;
    throw(error: any, disablePostCloseMessage?: true): Promise<IteratorResult<T, TReturn>>;
};

export function createFlow<T>(stargateOptions: MilkioStargateOptions, executeId: string): MilkioFlow<T> {
    let status: "pending" | "resolved" | "rejected" = "pending";
    const flows: Array<{
        blank: boolean;
        promise: Promise<T>;
        resolve: (value?: T | PromiseLike<T>) => void;
        reject: (reason?: any) => void;
    }> = [];

    const iterator = {
        emit: (flow: T) => {
            if (flows.at(-1)?.blank === true) {
                const item = flows.at(-1)!;
                item.blank = false;
                item.resolve(flow);
                return;
            } else {
                const resolvers = withResolvers<T>();
                resolvers.resolve(flow);
                flows.push({ ...resolvers, blank: false } as any);
            }
        },
        ...({
            async next(): Promise<IteratorResult<T>> {
                if (status !== "pending") return { done: true, value: null };
                if (flows.length === 0) {
                    const resolvers = withResolvers<T>();
                    flows.push({ ...resolvers, blank: true } as any);
                }
                const flow = flows.at(0)!;
                const result = await flow.promise;
                flows.shift();
                return { done: status !== "pending", value: result };
            },
            async return(_: undefined, disablePostCloseMessage?: true): Promise<IteratorResult<void>> {
                status = "resolved";
                if (!disablePostCloseMessage) stargateOptions.port.postMessage(`CLOSE_STREAM:${executeId}`);
                for (const flow of flows) {
                    flow.blank = false;
                    flow.resolve(undefined);
                }
                return { done: true, value: null };
            },
            async throw(err: any, disablePostCloseMessage?: true): Promise<IteratorResult<void>> {
                status = "rejected";
                if (!disablePostCloseMessage) stargateOptions.port.postMessage(`CLOSE_STREAM:${executeId}`);
                if (flows.length === 0) {
                    const resolvers = withResolvers<T>();
                    flows.push({ ...resolvers, blank: true } as any);
                }
                for (const flow of flows) {
                    flow.blank = false;
                    flow.reject(err);
                }
                return { done: true, value: null };
            },
        } satisfies AsyncIterator<unknown>),
        [Symbol.asyncIterator]() {
            return this;
        },
    };

    return iterator as MilkioFlow<T>;
}

function withResolvers<T = any>(): PromiseWithResolvers<T> {
    let resolve: PromiseWithResolvers<T>["resolve"];
    let reject: PromiseWithResolvers<T>["reject"];
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
}

const isoDatePattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(Z|[+-]\d{2}:?\d{2})?$/;

export function reviveJSONParse<T>(json: T): T {
    if (json !== null && typeof json === 'object') {
        if (json instanceof Date || (typeof (json as any).getTime === 'function' && typeof (json as any).toISOString === 'function')) {
            return json;
        }
        if (Array.isArray(json)) {
            return json.map((item) => reviveJSONParse(item)) as any;
        }
        return Object.entries(json).reduce((acc, [key, value]) => {
            acc[key as keyof T] = reviveJSONParse(value);
            return acc;
        }, {} as T);
    }
    if (typeof json === 'string') {
        const match = json.match(isoDatePattern);
        if (match) {
            const normalizedDateString = match[2] ? `${match[1]}${match[2].replace(':', '')}` : `${match[1]}Z`;
            return new Date(normalizedDateString) as any;
        }
    }
    return json;
}

const DB_NAME = 'StargateWorker';
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
                salt: encoder.encode('milkio-stargate-worker-cache'),
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
