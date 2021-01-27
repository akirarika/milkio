declare const _default: {
    name: any;
    primary: any;
    primaryType: any;
    _connection: false | import("./Connection").default;
    _database: import("./Model/Database").default;
    _cache: import("./Model/Cache").default;
    data: Record<string | number, any>;
    inserted$: import("rxjs").Subject<unknown>;
    deleted$: import("rxjs").Subject<unknown>;
    updated$: import("rxjs").Subject<unknown>;
    changed$: import("rxjs").Observable<unknown>;
    $: import("rxjs").BehaviorSubject<{
        type: string;
        key: null;
        value: null;
    }>;
    all(type: any): Promise<any>;
    query(): import("dexie").Table<any, import("dexie").IndexableType>;
    getResults(query: import("dexie").Table<any, import("dexie").IndexableType> | import("dexie").Collection<any, import("dexie").IndexableType>, resultProt?: any, type?: ObjectConstructor): Promise<any>;
    getResult(query: Promise<Record<string | number, any>>, resultProt?: {}): Promise<{}>;
    has(key: any): Promise<boolean>;
    set(key: any, func: any): Promise<void>;
    checkPrimary(key: any): any;
    _seeding(): Promise<any>;
    _humpToLine(str: string): string;
    _isPlainObject(obj: any): boolean;
};
export default _default;
