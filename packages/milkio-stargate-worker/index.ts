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
  type?: "action" | "stream";
};

export type ExecuteResultsOption = { executeId: string };

export type GeneratorGeneric<T> = T extends AsyncGenerator<infer I> ? I : never;

export async function createStargateWorker<Generated extends { routeSchema: any; rejectCode: any }>(stargateOptions: MilkioStargateOptions) {
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
    async execute<Path extends keyof Generated["routeSchema"]>(
      path: Path,
      options?: Mixin<
        ExecuteOptions,
        {
          params?: Generated["routeSchema"][Path]["types"]["params"];
        }
      >,
    ): Promise<
      Generated["routeSchema"][Path]["types"]["🐣"] extends boolean
        ? // action
          [Partial<Generated["rejectCode"]>, null, ExecuteResultsOption] | [null, Generated["routeSchema"][Path]["types"]["result"], ExecuteResultsOption]
        : // stream
          [Partial<Generated["rejectCode"]>, null, ExecuteResultsOption] | [null, AsyncGenerator<[Partial<Generated["rejectCode"]>, null] | [null, GeneratorGeneric<Generated["routeSchema"][Path]["types"]["result"]>], ExecuteResultsOption>]
    > {
      // biome-ignore lint/suspicious/noAsyncPromiseExecutor: <explanation>
      return new Promise(async (resolve, reject) => {
        await connect;
        const executeId = __createId();
        if (options?.type === "action" || !options?.type) {
          const handler = (event: { data: any }) => {
            if (typeof event.data !== "object") return;
            if (event.data.executeId !== executeId) return;
            stargateOptions.port.removeEventListener("message", handler);
            if (!event.data.success) resolve([event.data.error, null, { executeId }]);
            if (event.data.success) resolve([null, event.data.data, { executeId }] as any);
          };
          stargateOptions.port.addEventListener("message", handler);
          stargateOptions.port.postMessage({
            executeId,
            path,
            params: options?.params,
            headers: options?.headers,
          });
        }
        if (options?.type === "stream") {
          let flow: ReturnType<typeof createFlow> | undefined;
          console.log(1);
          const handler = (event: { data: any }) => {
            console.log(2, JSON.stringify(event.data));
            if (typeof event.data !== "object") return;
            if (event.data.executeId !== executeId) return;
            stargateOptions.port.removeEventListener("message", handler);
            console.log(3, event.data);
            if (!flow) {
              flow = createFlow();
              if (!event.data.success) resolve([event.data.error, null, { executeId }]);
              if (event.data.success) resolve([null, flow, { executeId }] as any);
            } else {
              console.log(4, event.data);
              if (event.data.done) flow.return();
              else if (event.data.success) flow.emit(event.data.data);
              else if (!event.data.success) flow.throw(event.data.data);
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
  };

  return stargate;
}

type Deferred<T> = {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
};

export type MilkioFlow<T, TReturn = any, TNext = any> = {
  emit: (flow: T) => void;
  [Symbol.asyncIterator]: () => MilkioFlow<T>;
  next(...[value]: [] | [TNext]): Promise<IteratorResult<T, TReturn>>;
  return(): Promise<IteratorResult<T, TReturn>>;
  throw(error: any): Promise<IteratorResult<T, TReturn>>;
};

export function createFlow<T>(): MilkioFlow<T> {
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
        const resolvers = Promise.withResolvers<T>();
        resolvers.resolve(flow);
        flows.push({ ...resolvers, blank: false } as any);
      }
    },
    ...({
      async next(): Promise<IteratorResult<T>> {
        if (status !== "pending") return { done: true, value: null };
        if (flows.length === 0) {
          const resolvers = Promise.withResolvers<T>();
          flows.push({ ...resolvers, blank: true } as any);
        }
        const flow = flows.at(0)!;
        const result = await flow.promise;
        flows.shift();
        return { done: status !== "pending", value: result };
      },
      async return(): Promise<IteratorResult<void>> {
        status = "resolved";
        for (const flow of flows) {
          flow.blank = false;
          flow.resolve(undefined);
        }
        return { done: true, value: null };
      },
      async throw(err: any): Promise<IteratorResult<void>> {
        status = "rejected";
        if (flows.length === 0) {
          const resolvers = Promise.withResolvers<T>();
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
