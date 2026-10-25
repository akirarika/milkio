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

// ---------------------------------------------------------------------------
// Failure protocol v2 (same wire as @milkio/stargate): `fail` keeps code + data,
// `fault` only carries the generic INTERNAL_SERVER_ERROR code.
// Types are duplicated locally on purpose: this package depends on neither stargate nor milkio.
// ---------------------------------------------------------------------------

export type MilkioFailureWire =
    | { kind: "fail"; code: string; data: unknown }
    | { kind: "fault"; code: "INTERNAL_SERVER_ERROR" };

/** structural shape of a failure restored from the wire (fail keeps code/data; fault stays generic) */
export interface MilkioClientFailure {
    readonly $milkioFailure: true;
    readonly kind: "fail" | "fault";
    readonly code: string;
    readonly data?: unknown;
}

/** faults synthesized by the client itself; they are not server fault-codes */
export type MilkioClientTransportFailure =
    | (MilkioClientFailure & { readonly kind: "fault"; readonly code: "NETWORK_ERROR" })
    | (MilkioClientFailure & { readonly kind: "fault"; readonly code: "REQUEST_TIMEOUT"; readonly data: { timeout: number; message: string } });

/**
 * Everything a stargate-worker call can fail with: the generated client-visible failure union
 * (all fail-codes with typed data + the generic server fault) plus the client transport faults.
 * The transport members carry literal codes so `failure.code` narrowing still works for fail-codes.
 */
export type MilkioPublicFailure<Generated extends { failure: any } = { failure: any }> = Generated["failure"] | MilkioClientTransportFailure;

function createFail(code: string, data?: unknown): MilkioClientFailure {
    return { $milkioFailure: true, kind: "fail", code, data };
}

function createFault(code: string, data?: unknown): MilkioClientFailure {
    return { $milkioFailure: true, kind: "fault", code, data };
}

/** only transport-level faults are retried; fail and server faults are never retried */
function isTransportFailure(failure: { readonly kind: string; readonly code: string }): boolean {
    return failure.kind === "fault" && (failure.code === "NETWORK_ERROR" || failure.code === "REQUEST_TIMEOUT");
}

/** restore a wire failure: fail keeps code/data, fault is always reduced to the generic code by the server */
function reviveFailureWire(wire: unknown): MilkioClientFailure {
    if (typeof wire === "object" && wire !== null) {
        const parsed = wire as { kind?: unknown; code?: unknown; data?: unknown };
        if (parsed.kind === "fail" && typeof parsed.code === "string") return createFail(parsed.code, parsed.data);
        if (parsed.kind === "fault") return createFault("INTERNAL_SERVER_ERROR");
    }
    return createFault("INTERNAL_SERVER_ERROR");
}

export async function createStargateWorker<Generated extends { routeSchema: any; failure: MilkioClientFailure }>(stargateOptions: MilkioStargateOptions) {
    type PublicFailure = MilkioPublicFailure<Generated>;
    /**
     * Restored wire failures are cast to the generated failure union: the server contract guarantees the
     * fail-code string is one of the generated codes, only the runtime value is unknown statically.
     */
    const reviveFailure = (wire: unknown): PublicFailure => reviveFailureWire(wire) as unknown as PublicFailure;

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
            consoleFn(...parsedArgs.slice(0, 5), ...parsedArgs.slice(5).map((v: any) => JSON.stringify(v)));
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
            [PublicFailure, null, ExecuteResultsOption] | [null, Generated["routeSchema"][Path]["types"]["result"], ExecuteResultsOption]
            : // stream
            [PublicFailure, null, ExecuteResultsOption] | [null, AsyncGenerator<[PublicFailure, null] | [null, GeneratorGeneric<Generated["routeSchema"][Path]["types"]["result"]>], undefined>, ExecuteResultsOption]
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

                    const executeRequest = (): Promise<[PublicFailure | null, any, ExecuteResultsOption]> => {
                        return new Promise((reqResolve) => {
                            const reqExecuteId = __createId();
                            executeIds.add(reqExecuteId);
                            const handler = (event: { data: any }) => {
                                if (typeof event.data !== "object") return;
                                if (event.data.executeId !== reqExecuteId) return;
                                executeIds.delete(reqExecuteId);
                                stargateOptions.port.removeEventListener("message", handler);
                                if (event.data.success !== true) {
                                    // { executeId, success:false, data:undefined, error: wireFailure, done:true }
                                    reqResolve([reviveFailure(event.data.error), null, { executeId: reqExecuteId }]);
                                } else {
                                    reqResolve([null, event.data.data, { executeId: reqExecuteId }]);
                                }
                            };
                            stargateOptions.port.addEventListener("message", handler);
                            stargateOptions.port.postMessage({
                                executeId: reqExecuteId,
                                path,
                                params: deepCloneIfVueReactive(options?.params),
                                headers: options?.headers,
                            });
                        });
                    };

                    let [failure, result, resultOption] = await executeRequest();

                    // only transport-level faults are retried; fail and server faults are never retried
                    for (let retryIndex = 0; retryIndex < retryCount && failure !== null && isTransportFailure(failure); retryIndex++) {
                        if (retryIndex > 0) {
                            await new Promise((r) => setTimeout(r, 500));
                        }
                        [failure, result, resultOption] = await executeRequest();
                    }

                    if (failure) {
                        // fail is a real business result and never falls back to cache; faults may fall back
                        if (cacheStrategy !== 'off' && cacheStorage && failure.kind !== 'fail') {
                            const cached = await cacheStorage.get(cacheKey);
                            if (cached) {
                                return resolve([null, cached.data, { executeId: 'cached' }] as any);
                            }
                        }
                        return resolve([failure, null, resultOption] as any);
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

                        const cleanup = () => {
                            stargateOptions.port.removeEventListener("message", handler);
                            executeIds.delete(executeId);
                        };

                        // data frames are `[null, value]`; failure frames are `[wireFailure, null]`
                        const data = event.data.data;
                        const frameFailure = Array.isArray(data) && data.length > 0 && data[0] !== null && data[0] !== undefined ? data[0] : undefined;
                        // action-like envelope (failure before the stream started) has `success:false` + `error`
                        const wireFailure = event.data.success !== true ? event.data.error : frameFailure;

                        if (!flow) {
                            if (wireFailure !== undefined) {
                                cleanup();
                                resolve([reviveFailure(wireFailure), null, { executeId }] as any);
                                return;
                            }
                            flow = createFlow(stargateOptions, executeId);
                            resolve([null, flow, { executeId }] as any);
                            // the start ack frame carries no data; a real first data frame is forwarded below
                            if (event.data.done) {
                                cleanup();
                                flow.return(undefined, true);
                            } else if (data !== undefined) {
                                flow.emit(data);
                            }
                            return;
                        }

                        if (wireFailure !== undefined) {
                            cleanup();
                            flow.throw(reviveFailure(wireFailure), true);
                        } else if (event.data.done) {
                            cleanup();
                            flow.return(undefined, true);
                        } else if (data !== undefined) {
                            flow.emit(data);
                        }
                    };
                    stargateOptions.port.addEventListener("message", handler);
                    stargateOptions.port.postMessage({
                        executeId,
                        path,
                        params: deepCloneIfVueReactive(options?.params),
                        headers: options?.headers,
                    });
                }
            });
        },
        $types: undefined as unknown as {
            generated: Generated,
            failure: PublicFailure;
            params: {
                [Path in keyof Generated["routeSchema"]]: Generated["routeSchema"][Path]["types"]["params"]
            },
            results: {
                [Path in keyof Generated["routeSchema"]]: Generated["routeSchema"][Path]["types"]["🥛"] extends boolean
                ? // action
                Generated["routeSchema"][Path]["types"]["result"]
                : // stream
                AsyncGenerator<[PublicFailure, null] | [null, GeneratorGeneric<Generated["routeSchema"][Path]["types"]["result"]>], undefined>
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

/** locally declared so the package does not require the `ESNext.Promise` lib (PromiseWithResolvers) */
export interface MilkioPromiseWithResolvers<T> {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
}

function withResolvers<T = any>(): MilkioPromiseWithResolvers<T> {
    let resolve: MilkioPromiseWithResolvers<T>["resolve"];
    let reject: MilkioPromiseWithResolvers<T>["reject"];
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

const deepCloneIfVueReactive = <T>(value: T): T => {
    if (value === null || value === undefined || typeof value !== 'object') return value;
    if (hasVueReactive(value)) {
        return deepClone(value);
    }
    return value;
};

const hasVueReactive = (value: any): boolean => {
    if (value === null || value === undefined || typeof value !== 'object') return false;
    if (value.__v_isReadonly !== undefined || value.__v_isReactive !== undefined) return true;
    if (Array.isArray(value)) {
        for (const item of value) {
            if (hasVueReactive(item)) return true;
        }
    } else if (!(value instanceof Date)) {
        for (const key of Object.keys(value)) {
            if (hasVueReactive(value[key])) return true;
        }
    }
    return false;
};

const deepClone = <T>(value: T): T => {
    if (value === null || value === undefined || typeof value !== 'object') return value;
    if (value instanceof Date) return value.toISOString() as T;
    if (Array.isArray(value)) return value.map((item) => deepClone(item)) as T;
    const result: Record<string, any> = {};
    for (const key of Object.keys(value as Record<string, any>)) {
        result[key] = deepClone((value as Record<string, any>)[key]);
    }
    return result as T;
};
