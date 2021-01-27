import { Table } from "dexie";
import Model from ".";
export default class Database {
    private model;
    constructor(model: Model);
    query(): Table;
    all(): Promise<any[]>;
    get(key: any): Promise<any>;
    put(key: any, value: any): Promise<void>;
    add(value: any, key?: undefined, returnPrimary?: boolean): Promise<any>;
    forget(key: any): Promise<void>;
    has(key: any): Promise<boolean>;
    encode(value: any): any;
    decode(value: any): any;
}
