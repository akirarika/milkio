import Model from ".";
import { PersistenceInterface } from "..";
export default class Persistence<T> {
    model: Model<T>;
    persistence: PersistenceInterface;
    async: boolean;
    constructor(model: Model<T>);
    insert(value: any, key?: string | number): string | number | Promise<string | number>;
    insertOrUpdate(key: string | number, value: any): void | Promise<void>;
    update(key: string | number, value: any): void | Promise<void>;
    select(key: string | number): any;
    exists(key: string | number): boolean | Promise<boolean>;
    delete(key: string | number): void;
    seeding(seeding: Function, model: Model<T>): void;
    query(): Object;
    all(): any[] | Promise<any[]>;
}
