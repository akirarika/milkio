import { Collection, Table } from "dexie";
import { Subject, BehaviorSubject } from "rxjs";
import Connection from "../Connection";
import Cache from "./Cache";
import Database from "./Database";
export default class Model {
    name: any;
    primary: any;
    primaryType: any;
    _connection: Connection | false;
    _database: Database;
    _cache: Cache;
    data: Record<string | number, any>;
    inserted$: Subject<unknown>;
    deleted$: Subject<unknown>;
    updated$: Subject<unknown>;
    changed$: import("rxjs").Observable<unknown>;
    $: BehaviorSubject<{
        type: string;
        key: null;
        value: null;
    }>;
    constructor(connection: Connection | false, [primary, primaryType]: [string, string]);
    all(type: any): Promise<any>;
    query(): Table;
    getResults(query: Collection | Table, resultProt?: any, type?: ObjectConstructor): Promise<any>;
    getResult(query: Promise<Record<string | number, any>>, resultProt?: {}): Promise<{}>;
    has(key: any): Promise<boolean>;
    set(key: any, func: any): Promise<void>;
    checkPrimary(key: any): any;
    _seeding(): Promise<any>;
    _humpToLine(str: string): string;
    _isPlainObject(obj: any): boolean;
}
