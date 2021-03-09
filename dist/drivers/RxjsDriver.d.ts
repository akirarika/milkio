import { CacheDriverInterface } from '..';
export default class RxjsDriver implements CacheDriverInterface {
    value: any;
    constructor(value: any, inject: any);
    set(value: any): void;
    get(): any;
    forget(): void;
    subscribe(): any;
}
