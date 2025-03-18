export type MilkioFlow<T> = AsyncIterator<T | undefined> & { emit: (flow: T) => void; [Symbol.asyncIterator]: () => MilkioFlow<T> };

export function createFlow<T>(): MilkioFlow<T> {
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
        flows.push({ ...resolvers, blank: false });
      }
    },
    ...({
      async next(): Promise<IteratorResult<T>> {
        if (flows.length === 0) {
          const resolvers = Promise.withResolvers<T>();
          flows.push({ ...resolvers, blank: true });
        }
        const flow = flows.at(0)!;
        const result = await flow.promise;
        flows.shift();
        return { done: false, value: result };
      },
      async return(): Promise<IteratorResult<void>> {
        for (const flow of flows) {
          flow.blank = false;
          flow.resolve(undefined);
        }
        return { done: true, value: undefined };
      },
      async throw(err: any): Promise<IteratorResult<void>> {
        if (flows.length === 0) {
          const resolvers = Promise.withResolvers<T>();
          flows.push({ ...resolvers, blank: true });
        }
        for (const flow of flows) {
          flow.blank = false;
          flow.reject(err);
        }
        return { done: true, value: undefined };
      },
    } satisfies AsyncIterator<unknown>),
    [Symbol.asyncIterator]() {
      return this;
    },
  };

  return iterator as MilkioFlow<T>;
}
