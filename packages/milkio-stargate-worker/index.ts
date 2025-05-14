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
          let generator: ReturnType<typeof createControllableAsyncGenerator> | undefined;
          console.log(1);
          const handler = (event: { data: any }) => {
            console.log(2, JSON.stringify(event.data));
            if (typeof event.data !== "object") return;
            if (event.data.executeId !== executeId) return;
            stargateOptions.port.removeEventListener("message", handler);
            console.log(3, event.data);
            if (!generator) {
              generator = createControllableAsyncGenerator();
              if (!event.data.success) resolve([event.data.error, null, { executeId }]);
              if (event.data.success) resolve([null, generator.generator, { executeId }] as any);
            } else {
              console.log(4, event.data);
              if (event.data.done) generator.complete();
              else if (event.data.success) generator.push(event.data.data);
              else if (!event.data.success) generator.error(event.data.data);
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

function createControllableAsyncGenerator<T>(): {
  generator: AsyncGenerator<T>;
  push: (value: T) => void;
  complete: (returnValue?: T) => void;
  error: (error: Error) => void;
} {
  const queue: Array<{ value?: T; done?: boolean; error?: Error }> = [];
  let deferred: Deferred<IteratorResult<T>> | null = null;
  let finished = false;

  const processQueue = () => {
    if (deferred && queue.length > 0) {
      const item = queue.shift()!;
      if (item.error) {
        deferred.reject(item.error);
      } else {
        deferred.resolve({ value: item.value!, done: item.done || false });
      }
      deferred = null;
    }
  };

  const generator: AsyncGenerator<T> = {
    [Symbol.asyncIterator]() {
      return generator;
    },

    async next(): Promise<IteratorResult<T>> {
      if (finished) return { value: undefined, done: true };

      return new Promise((resolve, reject) => {
        deferred = { resolve, reject };
        processQueue();
      });
    },

    async return(value?: T): Promise<IteratorResult<T>> {
      finished = true;
      queue.length = 0;
      return { value, done: true };
    },

    async throw(error?: Error): Promise<IteratorResult<T>> {
      finished = true;
      queue.length = 0;
      return Promise.reject(error);
    },
  } as any;

  return {
    generator,
    push: (value: T) => {
      if (finished) return;
      queue.push({ value });
      processQueue();
    },
    complete: (value?: T) => {
      if (finished) return;
      finished = true;
      queue.push({ done: true, value });
      processQueue();
    },
    error: (err: Error) => {
      if (finished) return;
      finished = true;
      queue.push({ error: err });
      processQueue();
    },
  };
}
