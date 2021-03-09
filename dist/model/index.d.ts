import { ModelInterface, ConfigInterface, CacheDriverInterface } from "..";
import Cache from "./cache";
import Persistence from "./persistence";
declare type DataItemInterface<T> = T & {
    id?: number | string;
};
interface DataInterface<T> {
    new (val: T, primary?: string | number): Promise<DataItemInterface<T>>;
    [others: string]: DataItemInterface<T>;
    [others: number]: DataItemInterface<T>;
}
export default class Model<T> implements ModelInterface {
    primary: string;
    config: ConfigInterface;
    data: DataInterface<T>;
    cache: Cache<T>;
    persistence: Persistence<T> | null;
    async: boolean;
    changed: CacheDriverInterface;
    $: any;
    constructor(options: ModelInterface);
    /**
     * 获取模型中的全部数据
     */
    all(): Record<number | string, T> | Promise<Record<number | string, T>>;
    /**
     * 判断数据是否存在于模型
     * @param key
     */
    has(key: string | number): boolean | Promise<boolean>;
    /**
     * 查询 (一般用于 indexeddb)
     * 可用于实现了 query 功能的持久化驱动
     * 一般返回一个由驱动实现的，可链式调用的查询对象
     */
    query(): any;
    /**
     * 获取数组形式的结果
     * @param query
     */
    getArrayResults(query: Array<T> | Promise<Array<T>>): Promise<Array<T>>;
    /**
     * 获取对象形式的结果
     */
    getObjectResults(query: Array<T> | Promise<Array<T>>): Promise<Record<number | string, T>>;
    /**
     * 获取结果
     * @param query
     * @param initialResult
     */
    getResults<T>(query: Array<any> | Promise<Array<any>>, initialResult?: Record<string | number, any> | Array<any>): Promise<T>;
    /**
     * 获取单个结果
     * @param query
     * @param initialResult
     */
    getResult(query: T | Promise<T>, initialResult?: Record<string | number, any>): Promise<T | null>;
    /**
     * 判断模型是否持久化
     */
    isPersistence(): boolean;
    /**
     * 编码
     * 将原数据封装为适合直接存储到 indexeddb 的对象格式
     * @param value
     * @param key
     */
    encode(value: any, key?: any): object;
    /**
     * 解码
     * 将 indexeddb 的对象格式还原为原来的数据
     * @param value
     */
    decode(value: any): any;
    /**
     * 校验主键
     * 验证主键使其必须和模型中声明的主键格式一致，如果模型要求组件是 number 类型，
     * 而传入的是字符串组成的 number 类型，则自动将其转为真正的 number 类型。
     * @param key
     */
    checkPrimary(key: any): any;
    /**
     * 深拷贝
     * 将对象深拷贝。在解决地址引用的同时，避免 proxy 对象无法存入 indexeddb 的问题。
     * 如果你是 vue3 用户，此函数可以解决 vue3 中的 data 对象无法存入 indexeddb 中的问题。
     * 通过 `model.data` 新增/更新的数据，会自动对值调用此函数来深拷贝。
     *
     * 可向第二个参数传入不被深拷贝的对象类型，避免如 `Set` `Map` `Blob` 等特殊对象被深拷贝
     * 导致数据丢失的问题。若第二个参数为空，则默认为不深拷贝以下对象：
     * [
     *   'Boolean',
     *   'String',
     *   'Date',
     *   'RegExp',
     *   'Blob',
     *   'File',
     *   'FileList',
     *   'ArrayBuffer',
     *   'DataView',
     *   'Uint8ClampedArray',
     *   'ImageData',
     *   'Map',
     *   'Set',
     * ]
     *
     * @param oldObject
     * @param intrinsicTypes
     */
    deepClone(oldObject: any, intrinsicTypes?: string[] | null): any;
    /**
     * 设置值
     * 此函数一般用于修改模型中存入的对象的子属性。
     * @param key
     * @param func
     */
    set(key: any, func: any): Promise<void>;
    _seeding(): Promise<void>;
    _checkConfig(config: ConfigInterface): ConfigInterface;
    _isPlainObject(object: any): boolean;
}
export {};
