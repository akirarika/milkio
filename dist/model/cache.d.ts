import { CacheDriverInterface } from "..";
import Model from ".";
export default class Cache<T> {
    private model;
    value: Map<string | number, CacheDriverInterface>;
    constructor(model: Model<T>);
    all(): {};
    subscribe(key: any): Function;
    get(key: any, def?: null): any;
    add(key: any, value: any): void;
    put(key: any, value: any): void;
    forget(key: any): void;
    has(key: any): boolean;
    count(): number;
    createCacheItem(value: any): any;
}
