import { __createId } from "./utils/create-id.ts";

export type MilkioStargateOptions = {
    port: {
        postMessage: (data: any) => void;
        addEventListener: (event: "message", callback: (event: { data: any }) => void) => void;
        removeEventListener: (event: "message", callback: (event: { data: any }) => void) => void;
    };
};

export type Mixin<T, U> = U & Omit<T, keyof U>;

export type ExecuteOptions = {
    params?: Record<any, any>;
    headers?: Record<string, string>;
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
    const stargate = {
        close() {
            for (const executeId of executeIds) {
                stargateOptions.port.postMessage(`CLOSE_STREAM:${executeId}`);
            }
            stargateOptions.port.postMessage("CLOSED");
        },
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
            // oxlint-disable-next-line no-async-promise-executor
            return new Promise(async (resolve) => {
                await connect;
                const executeId = __createId();
                executeIds.add(executeId);
                if (!(path as string).endsWith("~")) {
                    const handler = (event: { data: any }) => {
                        if (typeof event.data !== "object") return;
                        if (event.data.executeId !== executeId) return;
                        executeIds.delete(executeId);
                        stargateOptions.port.removeEventListener("message", handler);
                        if (!event.data.success) {
                            const error: any = {};
                            error[event.data.error.code] = event.data.error.reject;
                            resolve([error, null, { executeId }]);
                        }
                        if (event.data.success) resolve([null, event.data.data, { executeId }] as any);
                    };
                    stargateOptions.port.addEventListener("message", handler);
                    stargateOptions.port.postMessage({
                        executeId,
                        path,
                        params: options?.params,
                        headers: options?.headers,
                    });
                } else {
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
        types: {
            error<Path extends keyof Generated["routeSchema"]>(path: Path): Generated["rejectCode"] {
                throw new Error("This method is used to retrieve types and cannot be actually executed.");
            },
            params<Path extends keyof Generated["routeSchema"]>(path: Path): Generated["routeSchema"][Path]["types"]["params"] {
                throw new Error("This method is used to retrieve types and cannot be actually executed.");
            },
            results<Path extends keyof Generated["routeSchema"]>(path: Path): Generated["routeSchema"][Path]["types"]["🥛"] extends boolean
                ? // action
                Generated["routeSchema"][Path]["types"]["result"]
                : // stream
                AsyncGenerator<[Partial<Generated["rejectCode"]>, null] | [null, GeneratorGeneric<Generated["routeSchema"][Path]["types"]["result"]>], undefined> {
                throw new Error("This method is used to retrieve types and cannot be actually executed.");
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
