import { BehaviorSubject } from "rxjs";
import Model from ".";
export default class Cache {
    private model;
    value: Map<string | number, BehaviorSubject<any>>;
    constructor(model: Model);
    all(): {};
    get$(key: any, setInitialValue: any): BehaviorSubject<any> | undefined;
    get(key: any, def?: null): any;
    add(key: any, value: any): void;
    put(key: any, value: any): void;
    forget(key: any): void;
    has(key: any): boolean;
    count(): number;
}
