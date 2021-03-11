import { __awaiter } from "tslib";
export default class Data {
    constructor(model) {
        return new Proxy(function () { }, {
            set: (target, key, value, proxy) => {
                key = model.checkPrimary(key);
                value = model.deepClone(value);
                model.cache.put(key, value);
                if (model.isPersistence())
                    (() => __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        return yield ((_a = model.persistence) === null || _a === void 0 ? void 0 : _a.insertOrUpdate(key, model.cache.get(key)));
                    }))();
                model.changed.set(key);
                return true;
            },
            get: (target, key, receiver) => {
                var _a, _b;
                if ("string" === typeof key && key.endsWith("$")) {
                    // 取出订阅值，无需 await
                    key = key.substring(0, key.length - 1);
                    key = model.checkPrimary(key);
                    if (model.isPersistence() && !model.cache.has(key)) {
                        if (!model.async) {
                            // 值不存在，持久化，同步方式
                            model.cache.put(key, model.decode((_a = model.persistence) === null || _a === void 0 ? void 0 : _a.select(key)));
                            let result = model.cache.subscribe(key);
                            return result;
                        }
                        else {
                            // 值不存在，持久化，异步方式
                            (() => __awaiter(this, void 0, void 0, function* () {
                                var _c;
                                const value = yield ((_c = model.persistence) === null || _c === void 0 ? void 0 : _c.select(key));
                                if (value)
                                    model.cache.put(key, model.decode(value));
                            }))();
                            let result = model.cache.subscribe(key);
                            return result;
                        }
                    }
                    else {
                        // 值存在
                        let result = model.cache.subscribe(key);
                        return result;
                    }
                }
                else {
                    key = model.checkPrimary(key);
                    // 取出可用值
                    if (model.isPersistence()) {
                        if (!model.async) {
                            // 持久化，同步
                            let result = model.cache.get(key, null);
                            if (null !== result)
                                return result;
                            return model.decode((_b = model.persistence) === null || _b === void 0 ? void 0 : _b.select(key));
                        }
                        else {
                            return (() => __awaiter(this, void 0, void 0, function* () {
                                var _d;
                                // 持久化，异步
                                let result = model.cache.get(key, null);
                                if (null !== result)
                                    return result;
                                return model.decode(yield ((_d = model.persistence) === null || _d === void 0 ? void 0 : _d.select(key)));
                            }))();
                        }
                    }
                    else {
                        // 不持久化
                        return model.decode(model.cache.get(key, null));
                    }
                }
            },
            has: (target, key) => {
                key = model.checkPrimary(key);
                if (model.async)
                    throw new Error(`For persistent models, the result of the "in" operator may be incorrect, need "await modelName.has(key)" replace your "key in modelName.data".`);
                return model.cache.has(key);
            },
            construct: (target, [value, key = void 0]) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                // 此函数必须是异步的，因为 construct 函数只可以返回对象，
                // 所以需要利用异步函数来返回一个 Promise 对象，然后 await
                // 返回的结果，就可以拿到 number string 等类型的值了。
                value = model.deepClone(value);
                switch (model.config.type) {
                    case "string":
                        if (void 0 === key)
                            throw new Error(`Your model type is "string", the key cannot be undefined.`);
                        key = model.checkPrimary(key);
                        if (model.isPersistence()) {
                            // 字符串类型，持久化
                            yield ((_a = model.persistence) === null || _a === void 0 ? void 0 : _a.insertOrUpdate(key, value));
                            model.cache.add(key, value);
                            const result = model.decode(model.encode(value, key));
                            model.changed.set(key);
                            return result;
                        }
                        else {
                            // 字符串类型，不持久化
                            model.cache.add(key, value);
                            const result = model.decode(model.encode(value, key));
                            model.changed.set(key);
                            return result;
                        }
                        break;
                    case "number":
                        if (model.isPersistence()) {
                            // 整数模型，持久化
                            key = yield ((_b = model.persistence) === null || _b === void 0 ? void 0 : _b.insert(value));
                            model.cache.add(key, value);
                            const result = model.decode(model.encode(value, key));
                            model.changed.set(key);
                            return result;
                        }
                        else {
                            // 整数类型，不持久化
                            if ("__count" in model)
                                model["__count"]++;
                            else
                                model["__count"] = 1;
                            key = model["__count"];
                            model.cache.add(key, value);
                            const result = model.decode(model.encode(value, key));
                            model.changed.set(key);
                            return result;
                        }
                        break;
                }
            }),
            deleteProperty: (target, key) => {
                key = model.checkPrimary(key);
                model.cache.forget(key);
                if (model.isPersistence())
                    (() => __awaiter(this, void 0, void 0, function* () { var _a; return yield ((_a = model.persistence) === null || _a === void 0 ? void 0 : _a.delete(key)); }))();
                model.changed.set(key);
                return true;
            },
        });
    }
}
//# sourceMappingURL=data.js.map