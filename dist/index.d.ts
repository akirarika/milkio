import _localStorageDriver from "./drivers/LocalStorageDriver";
import _cookieDriver from "./drivers/CookieDriver";
import _dexieDriver from "./drivers/DexieDriver";
import _rxjsDriver from "./drivers/RxjsDriver";
import _model from "./model/index";
export declare const Model: typeof _model;
export declare const LocalStorageDriver: typeof _localStorageDriver;
export declare const CookieDriver: typeof _cookieDriver;
export declare const DexieDriver: typeof _dexieDriver;
export declare const RxjsDriver: typeof _rxjsDriver;
export interface ModelInterface {
    config: ConfigInterface;
    [others: string]: any;
}
export interface ConfigInterface {
    name: string;
    type: "string" | "number";
    drivers: DriversInterface;
    primary?: string;
    intrinsicTypes?: string[] | false;
}
export interface DriversInterface {
    cache: any;
    cacheInject?: any;
    persistence?: any;
    persistenceInject?: any;
}
export interface CacheDriverInterface {
    value: any;
    set(value: any): void;
    get(): any;
    forget(): void;
    subscribe(): any;
}
export interface PersistenceInterface {
    async: boolean;
    encode: boolean;
    all(): Array<any> | Promise<Array<any>>;
    insert(value: any, key?: string | number): string | number | Promise<string | number>;
    insertOrUpdate(key: string | number, value: any): void | Promise<void>;
    update(key: string | number, value: any): void | Promise<void>;
    select(key: string | number): any | Promise<any>;
    exists(key: string | number): boolean | Promise<boolean>;
    delete(key: string | number): void | Promise<void>;
    seeding(sedding: Function, model: any): void;
    query?(): Object;
}
