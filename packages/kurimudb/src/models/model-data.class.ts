export class ModelData {
  constructor(model) {
    return new Proxy(function () {}, {
      set: (target, key, value, proxy) => {
        key = model.checkPrimary(key);
        model.cache.put(key, value);
        if (model.isPersistence())
          (async () =>
            await model.storage.insertOrUpdate(key, model.cache.get(key)))();
        model.changed.set(key);
        return true;
      },
      get: (target, key, receiver) => {
        if ("string" === typeof key && key.endsWith("$")) {
          // 取出原始值，无需 await
          key = key.substring(0, key.length - 1);
          key = model.checkPrimary(key);
          if (model.isPersistence() && !model.cache.has(key)) {
            if (!model.options.async) {
              // 值不存在，持久化，同步方式
              model.cache.put(key, model.storage.select(key));
              const result = model.cache.subscribe(key);
              return result;
            } else {
              // 值不存在，持久化，异步方式
              (async () => {
                const value = await model.storage.select(key);
                if (void 0 !== value) model.cache.put(key, value);
              })();
              const result = model.cache.subscribe(key);
              return result;
            }
          } else {
            // 值存在
            const result = model.cache.subscribe(key);
            return result;
          }
        } else {
          key = model.checkPrimary(key);
          // 取出可用值
          if (model.isPersistence()) {
            if (!model.options.async) {
              // 持久化，同步
              const result = model.cache.get(key);
              if (void 0 !== result) return result;
              return model.storage.select(key);
            } else {
              return (async () => {
                // 持久化，异步
                const result = model.cache.get(key);
                if (void 0 !== result) return result;
                return await model.storage.select(key);
              })();
            }
          } else {
            // 不持久化
            return model.cache.get(key);
          }
        }
      },
      has: (target, key) => {
        key = model.checkPrimary(key);
        if (model.options.async)
          throw new Error(
            `For persistent models, the result of the "in" operator may be incorrect, need "await modelName.has(key)" replace your "key in modelName.data".`
          );
        return model.cache.has(key);
      },
      // construct: async (target, [value, key = void 0]) => {
      //   // 此函数必须是异步的，因为 construct 函数只可以返回对象，
      //   // 所以需要利用异步函数来返回一个 Promise 对象，然后 await
      //   // 返回的结果，就可以拿到 number string 等类型的值了。
      //   switch (model.options.type) {
      //     case 'string':
      //       if (void 0 === key) throw new Error(`Your model type is "string", the key cannot be undefined.`);
      //       key = model.checkPrimary(key);
      //       if (model.isPersistence()) {
      //         // 字符串类型，持久化
      //         await model.storage.insertOrUpdate(key, value);
      //         model.cache.add(key, value);
      //         const result = model.decode(model.encode(value, key));
      //         // model.changed.set(key);
      //         return result;
      //       } else {
      //         // 字符串类型，不持久化
      //         model.cache.add(key, value);
      //         const result = model.decode(model.encode(value, key));
      //         // model.changed.set(key);
      //         return result;
      //       }
      //       break;
      //     case 'number':
      //       if (model.isPersistence()) {
      //         // 整数模型，持久化
      //         key = await model.storage.insert(value);
      //         model.cache.add(key, value);
      //         const result = model.decode(model.encode(value, key));
      //         // model.changed.set(key);
      //         return result;
      //       } else {
      //         // 整数类型，不持久化
      //         if ('__count' in model) model['__count']++;
      //         else model['__count'] = 1;
      //         key = model['__count'];

      //         model.cache.add(key, value);
      //         const result = model.decode(model.encode(value, key));
      //         // model.changed.set(key);
      //         return result;
      //       }
      //       break;
      //   }
      // },
      deleteProperty: (target, key) => {
        key = model.checkPrimary(key);
        model.cache.forget(key);
        if (model.isPersistence())
          (async () => await model.storage.delete(key))();
        model.changed.set(key);

        return true;
      },
    });
  }
}
