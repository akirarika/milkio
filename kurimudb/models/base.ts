import { ModelOptionsInterface, PersistenceInterface } from "..";
import Cache from "../cache";
import { Item, subscribeInterface } from "../cache/item";
import Data from "../data";

type DataType<T> = T & {
  [others: string]: any;
};

export default class BaseModel<DataInterface, driver> {
  primary = "_id";
  options: ModelOptionsInterface;
  cache: Cache;
  data: DataType<DataInterface>;
  storage: driver;
  async = false;
  changed: Item<any>;
  $: subscribeInterface<string>;

  constructor(options: ModelOptionsInterface) {
    this.options = this._checkOptions(options);
    this.cache = new Cache(this);
    this.changed = this.cache.createCacheItem<string>("", this.options.name);
    this.$ = this.changed.subscribe;
    if (this.isPersistence())
      this.storage = new this.options.driver(this) as driver;
    else this.storage = (void 0 as unknown) as driver;
    this.data = new Data(this) as DataType<DataInterface>;
  }

  /**
   * 判断此模型是否可持久化
   */
  isPersistence(): boolean {
    return "driver" in this.options;
  }

  /**
   * 获取此模型全部数据
   */
  all(): object {
    if (this.isPersistence()) return (this.storage as any).all();
    else return this.cache.all();
  }

  /**
   * 校验主键
   * 验证主键使其必须和模型中声明的主键格式一致，如果模型要求组件是 number 类型，
   * 而传入的是字符串组成的 number 类型，则自动将其转为真正的 number 类型。
   * @param key
   */
  checkPrimary(key: any): string | number {
    if ("number" === this.options.type && !isNaN(Number(key)))
      return Number(key);
    if (this.options.type !== typeof key)
      throw new Error(
        `The model primary type needs to be ${
          this.options.type
        }, not ${typeof key}: ${key}`
      );
    return key;
  }

  /**
   * 深拷贝
   * 将对象深拷贝。在解决地址引用的同时，避免 proxy 对象无法存入 indexeddb 的问题。
   * 如果你是 vue3 用户，此函数可以解决 vue3 中的 data 对象无法存入 indexeddb 中的问题。
   * 通过 `model.data` 新增/更新的数据，会自动对值调用此函数来深拷贝。
   *
   * 可向第二个参数传入不被深拷贝的对象类型的数组 (字符串)，避免如 `Set` `Map` `Symbol` `Blob` 等特殊对象被深拷贝
   * 而导致数据丢失的问题。若第二个参数为空，则默认深拷贝全部对象。
   *
   * @param oldObject
   * @param intrinsicTypes
   */
  deepClone(oldObject: object, intrinsicTypes: string[] | null = null) {
    if (!oldObject || typeof oldObject !== "object") return oldObject;

    if (null === intrinsicTypes) {
      if (!("intrinsicTypes" in this.options)) intrinsicTypes = [];
      else if (false === this.options.intrinsicTypes) return oldObject;
      else intrinsicTypes = this.options.intrinsicTypes as string[];
    }

    if (Array.isArray(oldObject)) {
      const newObject: any = [];
      for (let i = 0, l = oldObject.length; i < l; ++i)
        newObject.push(this.deepClone(oldObject[i]));
      return newObject;
    }

    if (0 <= intrinsicTypes.indexOf(oldObject.constructor.name)) {
      return oldObject;
    }

    const newObject = new Object();
    for (const key in oldObject) {
      if (key in oldObject) newObject[key] = this.deepClone(oldObject[key]);
    }
    return newObject;
  }

  /**
   * 校验 options
   * @param options
   * @returns
   */
  _checkOptions(options: ModelOptionsInterface): ModelOptionsInterface {
    if (!options.name) throw new Error(`Model options "name" is required.`);
    if (!options.type) throw new Error(`Model options "type" is required.`);
    if ("string" !== options.type && "number" !== options.type)
      throw new Error(
        `Model options "type" value must be "string" or "number".`
      );

    if ("primary" in options) this.primary = options.primary as string;
    if ("methods" in options) Object.assign(this, options.methods);
    if (!("intrinsicTypes" in options))
      options.intrinsicTypes = [
        "Boolean",
        "String",
        "Date",
        "RegExp",
        "Blob",
        "File",
        "FileList",
        "ArrayBuffer",
        "DataView",
        "Uint8ClampedArray",
        "ImageData",
        "Map",
        "Set",
        "Symbol",
        "HTMLDivElement",
      ];

    return options;
  }

  /**
   * 调用填充模型
   * @returns
   */
  seed(seedFunc: Function) {
    if (!this.isPersistence()) return seedFunc();
    (this.storage as any).seeding(seedFunc, this);
  }

  getItem(key: string | number) {
    return this.data[key];
  }

  setItem(key: string | number, value: any) {
    (this.data as any)[key] = value;
  }

  removeItem(key: string | number) {
    delete this.data[key];
  }

  subscribeItem(key: string | number) {
    return this.data[`${key}$`];
  }
}
