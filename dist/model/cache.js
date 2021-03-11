export default class Cache {
    constructor(model) {
        this.value = new Map();
        this.model = model;
    }
    all() {
        const result = {};
        for (const [key, value] of this.value.entries())
            result[key] = value.get();
        return result;
    }
    subscribe(key) {
        var _a, _b;
        if (this.value.has(key))
            return (_a = this.value.get(key)) === null || _a === void 0 ? void 0 : _a.subscribe();
        this.value.set(key, this.createCacheItem(null));
        return (_b = this.value.get(key)) === null || _b === void 0 ? void 0 : _b.subscribe();
    }
    get(key, def = null) {
        var _a;
        if (this.value.has(key))
            return (_a = this.value.get(key)) === null || _a === void 0 ? void 0 : _a.get();
        return def;
    }
    add(key, value) {
        if (this.value.has(key))
            throw new Error(`Key already exists in the object store.`);
        this.value.set(key, this.createCacheItem(value));
    }
    put(key, value) {
        var _a;
        if (this.value.has(key))
            (_a = this.value.get(key)) === null || _a === void 0 ? void 0 : _a.set(value);
        else
            this.value.set(key, this.createCacheItem(value));
    }
    forget(key) {
        var _a;
        (_a = this.value.get(key)) === null || _a === void 0 ? void 0 : _a.forget();
        this.value.delete(key);
    }
    has(key) {
        return this.value.has(key);
    }
    count() {
        return this.value.size;
    }
    createCacheItem(value) {
        return new this.model.config.drivers.cache(value, this.model.config.drivers.cacheInject);
    }
}
//# sourceMappingURL=cache.js.map