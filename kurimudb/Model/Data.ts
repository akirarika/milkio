import Model from ".";

export default class Data<T> {
  constructor(model: Model<T>) {
    return new Proxy(function() {}, {
      set: (target: Data<T>, key: string | number, value, proxy) => {
        key = model.checkPrimary(key);
        value = model.deepClone(value);
        model.cache.put(key, value);
        if (model.isPersistence())
          (async () =>
            await model.persistence?.insertOrUpdate(
              key,
              model.cache.get(key)
            ))();
        model.changed.set(key);
        return true;
      },
      get: (target: Data<T>, key: string | number, receiver) => {
        if ("string" === typeof key && key.endsWith("$")) {
          // 取出订阅值，无需 await
          key = key.substring(0, key.length - 1);
          key = model.checkPrimary(key);
          if (model.isPersistence() && !model.cache.has(key)) {
            if (!model.async) {
              // 值不存在，持久化，同步方式
              model.cache.put(
                key,
                model.decode(model.persistence?.select(key))
              );
              let result = model.cache.subscribe(key);
              return result;
            } else {
              // 值不存在，持久化，异步方式
              (async () => {
                const value = await model.persistence?.select(key);
                if (value) model.cache.put(key, model.decode(value));
              })();
              let result = model.cache.subscribe(key);
              return result;
            }
          } else {
            // 值存在
            let result = model.cache.subscribe(key);
            return result;
          }
        } else {
          key = model.checkPrimary(key);
          // 取出可用值
          if (model.isPersistence()) {
            if (!model.async) {
              // 持久化，同步
              let result = model.cache.get(key, null);
              if (null !== result) return result;
              return model.decode(model.persistence?.select(key));
            } else {
              return (async () => {
                // 持久化，异步
                let result = model.cache.get(key, null);
                if (null !== result) return result;
                return model.decode(await model.persistence?.select(key));
              })();
            }
          } else {
            // 不持久化
            return model.decode(model.cache.get(key, null));
          }
        }
      },
      has: (target: Data<T>, key: string | number) => {
        key = model.checkPrimary(key);
        if (model.async)
          throw new Error(
            `For persistent models, the result of the "in" operator may be incorrect, need "await modelName.has(key)" replace your "key in modelName.data".`
          );
        return model.cache.has(key);
      },
      construct: async (target: Data<T>, [value, key = void 0]) => {
        // 此函数必须是异步的，因为 construct 函数只可以返回对象，
        // 所以需要利用异步函数来返回一个 Promise 对象，然后 await
        // 返回的结果，就可以拿到 number string 等类型的值了。
        value = model.deepClone(value);
        switch (model.config.type) {
          case "string":
            if (void 0 === key)
              throw new Error(
                `Your model type is "string", the key cannot be undefined.`
              );
            key = model.checkPrimary(key);
            if (model.isPersistence()) {
              // 字符串类型，持久化
              await model.persistence?.insertOrUpdate(key, value);
              model.cache.add(key, value);
              const result = model.decode(model.encode(value, key));
              model.changed.set(key);
              return result;
            } else {
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
              key = await model.persistence?.insert(value);
              model.cache.add(key, value);
              const result = model.decode(model.encode(value, key));
              model.changed.set(key);
              return result;
            } else {
              // 整数类型，不持久化
              if ("__count" in model) model["__count"]++;
              else model["__count"] = 1;
              key = model["__count"];

              model.cache.add(key, value);
              const result = model.decode(model.encode(value, key));
              model.changed.set(key);
              return result;
            }
            break;
        }
      },
      deleteProperty: (target: Data<T>, key: string | number) => {
        key = model.checkPrimary(key);
        model.cache.forget(key);
        if (model.isPersistence())
          (async () => await model.persistence?.delete(key))();
        model.changed.set(key);

        return true;
      },
    });
  }
}
