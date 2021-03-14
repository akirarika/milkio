import { PersistenceInterface } from "..";
export default class LocalStorageDriver implements PersistenceInterface {
    async: boolean;
    encode: boolean;
    primary: string;
    name: string;
    db: any;
    constructor(name: string, primary: string, inject: any);
    insert(value: any, key?: string | number): any;
    insertOrUpdate(key: string | number, value: any): void;
    update(key: string | number, value: any): void;
    select(key: string | number): any;
    exists(key: string | number): boolean;
    delete(key: string | number): void;
    seeding(seeding: Function, model: any): void;
    all(): never[];
}
