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
        const res = this.get(model.options.name, key);

        if (undefined === res) return def;
        return res;
      },
    };
  }

  get(modelName: string, key: string) {
    const modelCache = this.getModelCache(modelName);
  }

  private getModelCache(modelName: string) {
    if (modelName in value) return value[modelName];

    value[modelName] = new Map();
    return value[modelName];
  }
}
