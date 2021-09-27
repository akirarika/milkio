import { SyncAbstractDriver } from "../drivers/sync-abstract-driver.class";
import { BaseModel } from "../models/sync/base-model.class";
import { CacheItem } from "./cache-item.class";

const value: Record<string, Map<string, CacheItem>> = {};

export class CacheFactory {
  make<DataType, DriverType extends SyncAbstractDriver>(
    model: BaseModel<DataType, DriverType>
  ) {
    const changed = this.createCacheItem("", model.options.name);

    return {
      changed: changed,
      get: (key: string, def = undefined) => {
        const res = this.get(model.options.name, String(key));

        if (undefined === res) return def;
        return res;
      },
      put: (key: string, value: unknown) => {
        const skey = String(key);
        const res = this.put(model.options.name, skey, value);
        changed.set(skey);

        return res;
      },
      has: (key: string) => {
        const skey = String(key);
        return this.has(model.options.name, skey);
      },
      subscribe: (key: string) => {
        const skey = String(key);
        return this.subscribe(model.options.name, skey);
      },
      forget: (key: string) => {
        const skey = String(key);
        this.forget(model.options.name, skey);
      },
    };
  }

  get(modelName: string, key: string) {
    const modelCache = this.getModelCache(modelName);

    const cacheItem = modelCache.get(key);
    if (undefined === cacheItem) return undefined;

    return cacheItem.get();
  }

  put(modelName: string, key: string, value: unknown) {
    const modelCache = this.getModelCache(modelName);

    if (modelCache.has(key)) {
      const cacheItem = modelCache.get(key);
      cacheItem?.set(value);
    } else {
      modelCache.set(key, this.createCacheItem(value, key));
    }
  }

  has(modelName: string, key: string) {
    const modelCache = this.getModelCache(modelName);

    return modelCache.has(key);
  }

  subscribe(modelName: string, key: string) {
    const modelCache = this.getModelCache(modelName);

    if (modelCache.has(key)) {
      const cacheItem = modelCache.get(key);

      return cacheItem?.subscribe;
    }

    const cacheItem = this.createCacheItem(undefined, key);
    modelCache.set(key, cacheItem);
    return cacheItem.subscribe;
  }

  forget(modelName: string, key: string) {
    const modelCache = this.getModelCache(modelName);

    modelCache.get(key)?.forget();
    modelCache.delete(key);
  }

  private createCacheItem(value: unknown, key: string) {
    return new CacheItem(value, key);
  }

  private getModelCache(modelName: string) {
    if (modelName in value) return value[modelName];

    value[modelName] = new Map();
    return value[modelName];
  }
}
