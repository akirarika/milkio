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
