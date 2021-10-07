export function makeKurimudbMap<ValueType>() {
    return new Proxy(new Map<string, unknown>(), {
        get: (target, key: string, receiver) => target.get(key),
        set: (target, key: string, value) => (target.set(key, value), true),
        has: (target, key: string) => target.has(key),
        deleteProperty: (target, key: string) => target.delete(key),
        ownKeys: (target) => [...target.keys()],
        getOwnPropertyDescriptor: (target, key: string) => ({ enumerable: true, configurable: true, value: target.get(key) }),
    }) as unknown as KurimudbMap<ValueType>;
}

/**
 * KurimudbMap is a collection of like objects, the difference is that it will be traversed in strict insertion order.
 */
export type KurimudbMap<T> = Record<string, T>;