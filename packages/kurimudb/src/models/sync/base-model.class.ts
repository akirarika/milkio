import {
  SyncAbstractDriverInterface,
  SyncAbstractDriverFactory
} from "../../drivers/sync-abstract-driver.class";
import { ModelOptionsInterface } from "./model-options.interface";
import { cacheFactory, runtime, syncDataFactory } from "../../providers";
import { DataProxyType } from "../../data/sync/data-factory.class";
import { SubscribeInterface, UnsubscribeInterface } from "../../cache/subscribe.interface";
import { makeKMap } from "../../helpers/make-kurimudb-map.func";
import { CacheInterface } from "../../cache/cache-factory.class";
import { SubscribeConfigInterface } from "../../cache/subscribe-config.interface";
import { clone } from "../../helpers/clone.func";

let auto$nextId = 0;

interface AutoSubscribeClosureFunctionInterface {
  (): void | Promise<void>;
}

export class BaseModel<
  DataType extends Record<string, any>,
  DriverType extends SyncAbstractDriverInterface | undefined = undefined
  > {
  public options: ModelOptionsInterface;
  public cache: CacheInterface;
  public $: SubscribeInterface;
  public data: DataProxyType<DataType>;
  public storage: DriverType;

  constructor(options: Partial<ModelOptionsInterface>) {
    this.options = this.checkOptions(options);

    this.cache = cacheFactory.make<DataType>(this);
    this.$ = this.cache.changed.subscribe;
    this.data = syncDataFactory.make<DataType, DriverType>(this);

    if (undefined !== options.driver) {
      this.storage = options.driver.make<DataType, DriverType>(this) as DriverType;
    } else {
      this.storage = undefined as DriverType;
    }
  }

  private checkOptions(options: Partial<ModelOptionsInterface>): ModelOptionsInterface {
    if (!options.name) throw new Error(`[Kurimudb] The model "name" does not exist.`);
    if (!options.ioType || !options.modelType) {
      throw new Error(
        `[Kurimudb] The model "ioType" or "modelType" does not exist. Do you inherit "CollectionModel" or "KeyValueModel"? Please don't do that.`
      );
    }

    options.primary = options.primary ?? "_id";
    options.async = options.async ?? false;

    return options as ModelOptionsInterface;
  }

  getItem<Key extends keyof DataType>(key: Key): DataType[Key] | undefined {
    const skey = String(key);
    const result = this.cache.get(skey);
    if (undefined !== result) return result as DataType[Key];
    if (undefined === this.storage) return undefined;
    return this.storage.select(skey) as DataType[Key];
  }

  bulkGetItem<Key extends keyof DataType>(
    keys: Array<Key>
  ): Record<string, DataType[Key]> {
    if (undefined === this.storage) {
      const results = makeKMap<DataType[Key]>();
      for (const key of keys) {
        const skey = String(key);
        results[skey] = this.cache.get(skey) as DataType[Key];
      }
      return results;
    } else {
      const results = makeKMap<DataType[Key]>();
      const storageQueryItems: Array<string> = [];
      for (const key of keys) {
        const skey = String(key);
        results[skey] = this.cache.get(skey) as DataType[Key];
        if (undefined === results[skey]) storageQueryItems.push(skey);
      }

      const data = this.storage.bulkSelect(storageQueryItems);
      for (const skey in data) {
        results[skey] = data[skey] as DataType[Key];
      }
      return results;
    }
  }

  addItem<Key extends keyof DataType>(key: Key, value: DataType[Key]): boolean {
    value = this.clone(value);
    const skey = String(key);
    if (undefined !== this.storage) {
      if (false === this.storage.insert(skey, value)) return false;
    }
    this.cache.put(skey, value);
    return true;
  }

  bulkAddItem<Key extends keyof DataType>(items: Record<Key, DataType[Key]>): boolean {
    items = this.clone(items);
    const skeyItems = makeKMap<unknown>();
    for (const key in items) skeyItems[String(key)] = items[key];

    if (undefined !== this.storage) {
      if (false === this.storage.bulkInsert(skeyItems)) return false;
    }

    for (const skey in skeyItems) {
      this.cache.put(skey, skeyItems[skey]);
    }

    return true;
  }


  setItem<Key extends keyof DataType>(key: Key, value: DataType[Key]): void {
    value = this.clone(value);
    const skey = String(key);
    this.cache.put(skey, value);
    if (undefined === this.storage) return;
    this.storage.insertOrUpdate(skey, value);
  }

  bulkSetItem<Key extends keyof DataType>(items: Record<Key, DataType[Key]>): boolean {
    items = this.clone(items);
    const skeyItems = makeKMap<unknown>();
    for (const key in items) skeyItems[String(key)] = items[key];

    if (undefined !== this.storage) {
      if (false === this.storage.bulkInsertOrUpdate(skeyItems)) return false;
    }

    for (const skey in skeyItems) {
      this.cache.put(skey, skeyItems[skey]);
    }

    return true;
  }

  hasItem<Key extends keyof DataType>(key: Key): boolean {
    const skey = String(key);
    if (this.cache.has(skey)) return true;
    if (undefined === this.storage) return false;
    return this.storage.exists(skey);
  }

  removeItem<Key extends keyof DataType>(key: Key): void {
    const skey = String(key);
    this.cache.forget(skey);
    if (undefined === this.storage) return;
    this.storage.delete(skey);
  }

  bulkRemoveItem<Key extends keyof DataType>(keys: Array<Key>): boolean {
    if (undefined !== this.storage) {
      if (false === this.storage.bulkDelete(keys.map((k) => String(k)))) return false;
    }
    for (const key of keys) this.cache.forget(String(key));
    return true;
  }

  subscribeItem<Key extends keyof DataType>(key: Key): SubscribeInterface {
    const skey = String(key);
    return this.cache.subscribe(skey);
  }

  clone<T>(value: T): T {
    if (undefined === this.storage) {
      return clone(value);
    } else {
      return this.storage.clone(value) as T;
    }
  }

  auto$(
    subClosFunc: AutoSubscribeClosureFunctionInterface,
    config: SubscribeConfigInterface = {}
  ): UnsubscribeInterface | Promise<UnsubscribeInterface> {
    config.immediate = false; // 所有用 auto$ 进行的订阅，均不主动触发首次订阅，由队列函数去主动触发
    if (undefined === runtime.readModelInternalItemDependencies[this.options.name]) {
      runtime.readModelInternalItemDependencies[this.options.name] = {};
    }
    const id = auto$nextId++;
    runtime.readModelInternalItemDependencies[this.options.name][id] = [];

    const r = subClosFunc();
    const subscribe = () => {
      const unsubscribeFuncArr = runtime.readModelInternalItemDependencies[this.options.name][id].map((item) => {
        return item.subscribe(subClosFunc, config);
      });
      delete runtime.readModelInternalItemDependencies[this.options.name][id];
      return () => {
        unsubscribeFuncArr.forEach((unsubscribe) => unsubscribe());
      };
    }
    if ("function" !== typeof r?.then) {
      return subscribe();
    } else {
      return (async () => {
        await r;
        return subscribe();
      })();
    }
  }
}
