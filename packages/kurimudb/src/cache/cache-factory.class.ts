import { AbstractDriver } from "../abstract-driver.class";
import { BaseModel } from "../models/sync/base-model.class";
import { CacheItem } from "./cache-item.class";

const value: Record<string, Map<string, CacheItem>> = {};

export class CacheFactory {
  readItemDependencies: Array<CacheItem> = [];
  collectingReadItemDependencies = false;

  make<DataType, DriverType extends AbstractDriver>(
    model: BaseModel<DataType, DriverType>
  ) {
    return {
      get: (key: string, def = undefined) => {
        const res = this.get(model.options.name, String(key));

        if (undefined === res) return def;
        return res;
      },
      put: (key: string, value: unknown) => {
        return this.put(model.options.name, String(key), value);
      },
    };
  }

  get(modelName: string, key: string) {
    const modelCache = this.getModelCache(modelName);
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

  private createCacheItem(value: unknown, key: string) {
    return new CacheItem(value, key);
  }

  private getModelCache(modelName: string) {
    if (modelName in value) return value[modelName];

    value[modelName] = new Map();
    return value[modelName];
  }
}
