import Data from "./data";
import Cache from "./cache";
import Persistence from "./persistence";
export default class Model {
    constructor(options) {
        this.primary = "id";
        this.persistence = null;
        this.async = false;
        this.config = this._checkConfig(options.config);
        Object.assign(this, options);
        if (this.isPersistence()) {
            this.persistence = new Persistence(this);
            this.async = this.persistence.async;
        }
        this.data = new Data(this);
        this.cache = new Cache(this);
        this.changed = this.cache.createCacheItem(null);
        this.$ = this.changed.subscribe();
        this._seeding();
    }
    /**
     * 获取模型中的全部数据
     */
    all() {
        if (this.isPersistence())
            return this.getObjectResults(this.persistence?.all());
        else
            return this.cache.all();
    }
    /**
     * 判断数据是否存在于模型
     * @param key
     */
    has(key) {
        key = this.checkPrimary(key);
        if (this.cache.has(key))
            return true;
        if (this.async)
            return this.persistence?.exists(key);
        return false;
    }
    /**
     * 查询 (一般用于 indexeddb)
     * 可用于实现了 query 功能的持久化驱动
     * 一般返回一个由驱动实现的，可链式调用的查询对象
     */
    query() {
        return this.persistence?.query();
    }
    /**
     * 获取数组形式的结果
     * @param query
     */
    async getArrayResults(query) {
        return await this.getResults(query, new Array());
    }
    /**
     * 获取对象形式的结果
     */
    async getObjectResults(query) {
        return await this.getResults(query, new Object());
    }
    /**
     * 获取结果
     * @param query
     * @param initialResult
     */
    async getResults(query, initialResult = new Object()) {
        if (!this.isPersistence())
            throw new Error(`This method can only be called by a model that has been persisted.`);
        query = await query;
        if (!(query instanceof Array))
            throw new Error(`The query result is not a single object. If it's an array, please use 'getresult' instead.`);
        const setResult = (key, value) => {
            if (initialResult instanceof Array)
                initialResult.push(value);
            else
                initialResult[key] = value;
        };
        for (const item of query) {
            const key = item[this.primary];
            if (this.cache.has(key))
                setResult(key, this.cache.get(key));
            else {
                setResult(key, this.decode(item));
                this.cache.add(key, this.decode(item));
            }
        }
        return initialResult;
    }
    /**
     * 获取单个结果
     * @param query
     * @param initialResult
     */
    async getResult(query, initialResult = new Object()) {
        if (!this.isPersistence())
            throw new Error(`This method can only be called by a model that has been persisted.`);
        const item = await query;
        if (!this._isPlainObject(item))
            throw new Error(`The query result is not a single Object. If it's an Array, please use 'getresults' instead.`);
        const key = item[this.primary];
        if (this.cache.has(key))
            initialResult = {
                ...initialResult,
                ...this.cache.get(key),
            };
        else {
            initialResult = this.decode(item);
            this.cache.add(key, initialResult);
        }
        return initialResult;
    }
    /**
     * 判断模型是否持久化
     */
    isPersistence() {
        return "persistence" in this.config.drivers;
    }
    /**
     * 编码
     * 将原数据封装为适合直接存储到 indexeddb 的对象格式
     * @param value
     * @param key
     */
    encode(value, key = void 0) {
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
            if (void 0 !== key)
                value[this.primary] = key;
            return value;
        }
        else {
            const object = { $__value: value };
            if (void 0 !== key)
                object[this.primary] = key;
            return object;
        }
    }
    /**
     * 解码
     * 将 indexeddb 的对象格式还原为原来的数据
     * @param value
     */
    decode(value) {
        if (void 0 === value || null === value)
            return null;
        if ("object" === typeof value && "$__value" in value)
            return value["$__value"];
        return value;
    }
    /**
     * 校验主键
     * 验证主键使其必须和模型中声明的主键格式一致，如果模型要求组件是 number 类型，
     * 而传入的是字符串组成的 number 类型，则自动将其转为真正的 number 类型。
     * @param key
     */
    checkPrimary(key) {
        if ("number" === this.config.type && !isNaN(Number(key)))
            return Number(key);
        if (this.config.type !== typeof key)
            throw new Error(`The model primary type needs to be ${this.config.type}, not ${typeof key}`);
        return key;
    }
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
    deepClone(oldObject, intrinsicTypes = null) {
        if (!oldObject || typeof oldObject !== "object")
            return oldObject;
        if (null === intrinsicTypes) {
            if (!("intrinsicTypes" in this.config))
                intrinsicTypes = [
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
                ];
            else if (false === this.config.intrinsicTypes)
                return oldObject;
            else
                intrinsicTypes = this.config.intrinsicTypes;
        }
        if (Array.isArray(oldObject)) {
            let newObject = new Array();
            for (let i = 0, l = oldObject.length; i < l; ++i)
                newObject.push(this.deepClone(oldObject[i]));
            return newObject;
        }
        if (0 <= intrinsicTypes.indexOf(oldObject.constructor.name)) {
            return oldObject;
        }
        let newObject = new Object();
        for (let key in oldObject) {
            if (key in oldObject)
                newObject[key] = this.deepClone(oldObject[key]);
        }
        return newObject;
    }
    /**
     * 设置值
     * 此函数一般用于修改模型中存入的对象的子属性。
     * @param key
     * @param func
     */
    async set(key, func) {
        key = this.checkPrimary(key);
        const val = await this.data[key];
        await func(val);
        if (val instanceof Array)
            this.data[key] = [...val];
        else if (val instanceof Object)
            this.data[key] = { ...val };
        else
            this.data[key] = val;
    }
    async _seeding() {
        if (!this["seeding"])
            return;
        if (!this.isPersistence())
            return this["seeding"](this);
        this.persistence?.seeding(this["seeding"], this);
    }
    _checkConfig(config) {
        if (!config.name)
            throw new Error(`Model options "name" is required.`);
        if (!config.type)
            throw new Error(`Model options "type" is required.`);
        if ("string" !== config.type && "number" !== config.type)
            throw new Error(`Model options "type" value must be "string" or "number".`);
        if (!config.drivers)
            throw new Error(`Model options "drivers" is required.`);
        if (!config.drivers.cache)
            throw new Error(`Model options "drivers.cache" is required.`);
        if ("primary" in config)
            this.primary = config.primary;
        return config;
    }
    _isPlainObject(object) {
        if ("Object" !== object?.constructor?.name)
            return false;
        return true;
    }
}
//# sourceMappingURL=index.js.map