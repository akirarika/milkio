import { Table } from "dexie";

const INSTRINSIC_TYPES = [
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
] as const;

export class DexieDriver {
  model;

  constructor(model) {
    this.model = model;
    this.model.options.async = true;
    if (!("db" in this.model.options))
      throw new Error(
        `"db" does not exist in options of the model, pass it a dexie object.`
      );
  }

  async insert(value: any, key?: string | number): Promise<string | number> {
    return (await this.table().add(this.encode(value))) as string | number;
  }

  async insertOrUpdate(key: string | number, value: any): Promise<void> {
    await this.table().put(this.encode(value, key));
  }

  async update(key: string | number, value: any): Promise<void> {
    await this.table().put(this.encode(value, key));
  }

  async select(key: string | number): Promise<any> {
    return this.decode(await this.table().get(key));
  }

  async exists(key: string | number): Promise<boolean> {
    return Boolean(
      await this.table().where(this.model.options.primary).equals(key).count()
    );
  }

  async delete(key: string | number): Promise<void> {
    await this.table().delete(key);
  }

  async seeding(seedingFunc: Function, model) {
    const table = this.model.options.db["_seed"];
    if (await table.get(`${this.model.options.name}_is_seeded`)) return;

    await table.add({
      _id: `${this.model.options.name}_is_seeded`,
      value: `true`,
    });
    await seedingFunc(model);
  }

  all() {
    return this.getArrayResults(this.table().toArray());
  }

  /**
   * 获取当前表对象
   * @returns
   */
  table(): Table {
    const table = this.model.options?.db[this.model.options.name];
    if (table) return table;
    throw new Error(
      `table "${this.model.options.name}" does not exist in the database. did you forget to add the new version?`
    );
  }

  /**
   * 编码
   * 将原数据封装为适合直接存储到 indexeddb 的对象格式
   * @param value
   * @param key
   */
  encode(value: any, key: any = void 0): object {
    if (this._isPlainObject(value)) {
      // if (this.primary in value)
      //   throw new Error(
      //     'The object you want to store contains the attribute with the value of "' +
      //       this.primary +
      //       '", ' +
      //       "which is the same as the primary key name specified in your model. " +
      //       'Consider changing this value to a different name, such as "' +
      //       this.config.name +
      //       "_" +
      //       this.primary +
      //       '".'
      //   );
      if (void 0 !== key) value[this.model.options.primary] = key;
      return this.model.deepClone(value, INSTRINSIC_TYPES);
    } else {
      const object: any = { $__value: value };
      if (void 0 !== key) object[this.model.options.primary] = key;
      return this.model.deepClone(object, INSTRINSIC_TYPES);
    }
  }

  /**
   * 解码
   * 将 indexeddb 的对象格式还原为原来的数据
   * @param value
   */
  decode(value: any): any {
    if (void 0 === value || null === value) return null;
    if ("object" === typeof value && "$__value" in value)
      return value["$__value"];
    return value;
  }

  /**
   * 查询 (一般用于 indexeddb)
   * 可用于实现了 query 功能的持久化驱动
   * 一般返回一个由驱动实现的，可链式调用的查询对象
   */
  query(): Table {
    return this.table();
  }

  /**
   * 获取数组形式的结果
   * @param query
   */
  async getArrayResults<T>(
    query: Array<T> | Promise<Array<T>>
  ): Promise<Array<T>> {
    return await this.getResults(query, []);
  }

  /**
   * 获取对象形式的结果
   */
  async getObjectResults<T>(
    query: Array<T> | Promise<Array<T>>
  ): Promise<Record<number | string, T>> {
    return await this.getResults(query, new Object());
  }

  /**
   * 获取结果
   * @param query
   * @param initialResult
   */
  async getResults<T>(
    query: Array<any> | Promise<Array<any>>,
    initialResult: Record<string | number, any> | Array<any> = new Object()
  ): Promise<T> {
    query = await query;
    if (!(query instanceof Array))
      throw new Error(
        `The query result is not a single object. If it's an array, please use 'getResult' instead.`
      );

    const setResult = (key: any, value: any) => {
      if (initialResult instanceof Array) initialResult.push(value);
      else initialResult[key] = value;
    };

    for (const item of query) {
      const key = item[this.model.options.primary];
      if (this.model.cache.has(key)) setResult(key, this.model.cache.get(key));
      else {
        setResult(key, this.decode(item));
        this.model.cache.add(key, this.decode(item));
      }
    }
    return initialResult as T;
  }

  /**
   * 获取单个结果
   * @param query
   * @param initialResult
   */
  async getResult<T>(query: T | Promise<T>): Promise<T | null> {
    const item: any = await query;
    if (void 0 === item || null === item) return null;
    if (!this._isPlainObject(item))
      throw new Error(
        `The query result is not a single Object. If it's an Array, please use 'getresults' instead.`
      );
    const key = item[this.model.options.primary];
    if (this.model.cache.has(key)) return this.model.cache.get(key);
    else {
      const initialResult = this.decode(item);
      this.model.cache.add(key, initialResult);
      return initialResult;
    }
  }

  _isPlainObject(object: any): boolean {
    if ("Object" !== object?.constructor?.name) return false;
    return true;
  }
}
