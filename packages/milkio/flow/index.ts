export type MilkioFlow<T> = {
    emit: (flow: T) => void;
    next: () => Promise<T>;
}

export function createFlow<T extends unknown>(): MilkioFlow<T> {
    const flows: Array<{
        blank: boolean;
        promise: Promise<T>;
        resolve: (value?: T | PromiseLike<T>) => void;
        reject: (reason?: any) => void;
    }> = [];

    return {
        emit: (flow: T) => {
            if (flows.at(-1)?.blank === true) {
                flows.at(-1)!.resolve(flow);
                return;
            }
            const resolvers = Promise.withResolvers<T>();
            resolvers.resolve(flow);
            flows.push({ ...resolvers, blank: false });
        },
        next: async () => {
            if (flows.length === 0) {
                const resolvers = Promise.withResolvers<T>();
                flows.push({ ...resolvers, blank: true });
            }
            const flow = flows.at(0)!;
            const result = await flow.promise;
            flows.shift();
            return result;
        },
    }
}