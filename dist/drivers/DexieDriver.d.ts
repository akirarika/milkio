import { Table } from 'dexie';
import { PersistenceInterface } from '..';
export default class DexieDriver implements PersistenceInterface {
    async: boolean;
    primary: string;
    name: string;
    db: any;
    constructor(name: string, primary: string, inject: any);
    insert(value: any, key?: string | number): Promise<any>;
    insertOrUpdate(key: string | number, value: any): Promise<void>;
    update(key: string | number, value: any): Promise<void>;
    select(key: string | number): Promise<any>;
    exists(key: string | number): Promise<boolean>;
    delete(key: string | number): Promise<void>;
    seeding(seedingFunc: Function, model: any): Promise<void>;
    query(): Table;
    all(): any;
    _table(): any;
}
