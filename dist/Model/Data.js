export default class Data {
    constructor(model) {
        return new Proxy(function () { }, {
            construct: async (target, [value, key = void 0]) => {
                if (model._connection)
                    value = await model._database.add(value, key, false);
                if (void 0 === key)
                    key = value[model.primary];
                model._cache.add(key, value);
                model.inserted$.next({
                    type: "inserted",
                    key: key,
                    value: value,
                });
                return value;
            },
            deleteProperty: (target, key) => {
                key = model.checkPrimary(key);
                model._cache.forget(key);
                if (model._connection)
                    (async () => await model._database.forget(key))();
                model.deleted$.next({
                    type: "deleted",
                    key: key,
                    value: null,
                });
                return true;
            },
            set: (target, key, value, proxy) => {
                key = model.checkPrimary(key);
                model._cache.put(key, value);
                if (model._connection)
                    (async () => await model._database.put(key, value))();
                model.updated$.next({
                    type: "updated",
                    key: key,
                    value: value,
                });
                return true;
            },
            get: (target, key, receiver) => {
                key = model.checkPrimary(key);
                if ("string" === typeof key && key.endsWith("$"))
                    return model._cache.get$(key.substring(0, key.length - 1), async (key) => {
                        if (model._connection)
                            model._cache.put(key, await model._database.get(key));
                    });
                return (async () => {
                    let result = model._cache.get(key, null);
                    if (model._connection && null === result)
                        result = await model._database.get(key);
                    return result;
                })();
            },
            has: (target, key) => {
                key = model.checkPrimary(key);
                if (model._connection)
                    throw new Error(`For persistent models, the result of the "in" operator may be incorrect, need "await modelName.has(key)" replace your "key in modelName.data".`);
                return model._cache.has(key);
            },
        });
    }
}
//# sourceMappingURL=Data.js.map