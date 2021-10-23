import { SyncAbstractDriverInterface, AsyncAbstractDriverInterface, AsyncAbstractDriverFactory } from "../..";
import { ModelOptionsInterface } from "./model-options.interface";
import { cacheFactory, asyncDataFactory, runtime } from "../../providers";
import { DataProxyType } from "../../data/async/data-factory.class";
import { SubscribeInterface, UnsubscribeInterface } from "../../cache/subscribe.interface";
import { KMap, makeKMap } from "../../helpers/make-kurimudb-map.func";
import { CacheInterface } from "../../cache/cache-factory.class";
import { SubscribeConfigInterface } from "../../cache/subscribe-config.interface";
import { clone } from "../../helpers/clone.func";

let auto$nextId = 0;

interface AutoSubscribeClosureFunctionInterface {
  (): Promise<void>;
}

export class BaseModel<
  DataType extends Record<string, any>,
  DriverType extends AsyncAbstractDriverInterface | SyncAbstractDriverInterface | undefined = undefined
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
    this.data = asyncDataFactory.make<DataType, DriverType>(this);

    if (undefined !== options.driver) {
      this.storage = (options.driver as AsyncAbstractDriverFactory).make<DataType, DriverType>(this) as DriverType;
    } else {
      this.storage = undefined as DriverType;
    }
  }

  private checkOptions(options: Partial<ModelOptionsInterface>): ModelOptionsInterface {
    if (!options.name) throw new Error(`[Kurimudb] The model "name" does not exist.`);
    if (!options.ioType || !options.modelType) {
      throw new Error(
        `[Kurimudb] The model "ioType" or "modelType" does not exist. Do you inherit "CollectionModel" or "KeyValueModel"?`
      );
    }

    options.primary = options.primary ?? "_id";
    options.async = options.async ?? false;

    return options as ModelOptionsInterface;
  }

  async getItem<Key extends keyof DataType>(key: Key): Promise<DataType[Key] | undefined> {
    const skey = String(key);
    const result = this.cache.get(skey);
    if (undefined !== result) return result as DataType[Key];
    if (undefined === this.storage) return undefined;
    return await this.storage.select(skey) as DataType[Key];
  }

  async bulkGetItem<Key extends keyof DataType>(
    keys: Array<Key>
  ): Promise<Record<string, DataType[Key]>> {
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

      const data = await this.storage.bulkSelect(storageQueryItems);
      for (const skey in data) {
        results[skey] = data[skey] as DataType[Key];
      }
      return results;
    }
  }

  async addItem<Key extends keyof DataType>(key: Key, value: DataType[Key]): Promise<boolean> {
    value = await this.clone(value);
    const skey = String(key);
    if (undefined !== this.storage) {
      if (false === await this.storage.insert(skey, value)) return false;
    }
    this.cache.put(skey, value);
    return true;
  }

  async bulkAddItem<Key extends keyof DataType>(items: Record<Key, DataType[Key]>): Promise<boolean> {
    items = await this.clone(items);
    const skeyItems = makeKMap<unknown>();
    for (const key in items) skeyItems[String(key)] = items[key];

    if (undefined !== this.storage) {
      if (false === await this.storage.bulkInsert(skeyItems)) return false;
    }

    for (const skey in skeyItems) {
      this.cache.put(skey, skeyItems[skey]);
    }

    return true;
  }

  async setItem<Key extends keyof DataType>(key: Key, value: DataType[Key]): Promise<void> {
    value = await this.clone(value);
    const skey = String(key);
    this.cache.put(skey, value);
    if (undefined === this.storage) return;
    return await this.storage.insertOrUpdate(skey, value);
  }

  async bulkSetItem<Key extends keyof DataType>(items: Record<Key, DataType[Key]>): Promise<boolean> {
    items = await this.clone(items);
    const skeyItems = makeKMap<unknown>();
    for (const key in items) skeyItems[String(key)] = items[key];

    if (undefined !== this.storage) {
      if (false === await this.storage.bulkInsertOrUpdate(skeyItems)) return false;
    }

    for (const skey in skeyItems) {
      this.cache.put(skey, skeyItems[skey]);
    }

    return true;
  }

  async hasItem<Key extends keyof DataType>(key: Key): Promise<boolean> {
    const skey = String(key);
    if (this.cache.has(skey)) return true;
    if (undefined === this.storage) return false;
    return await this.storage.exists(skey);
  }

  async removeItem<Key extends keyof DataType>(key: Key): Promise<void> {
    const skey = String(key);
    this.cache.forget(skey);
    if (undefined === this.storage) return;
    return await this.storage.delete(skey) as unknown as Promise<void>;
  }

  async bulkRemoveItem<Key extends keyof DataType>(keys: Array<Key>): Promise<boolean> {
    if (undefined !== this.storage) {
      if (false === await this.storage.bulkDelete(keys.map((k) => String(k)))) return false;
    }
    for (const key of keys) this.cache.forget(String(key));
    return true;
  }

  subscribeItem<Key extends keyof DataType>(key: Key): SubscribeInterface {
    const skey = String(key);
    return this.cache.subscribe(skey);
  }

  async clone<T>(value: T): Promise<T> {
    if (undefined === this.storage) {
      return clone(value);
    } else {
      return await this.storage.clone(value) as T;
    }
  }

  async auto$(
    subClosFunc: AutoSubscribeClosureFunctionInterface,
    config: SubscribeConfigInterface = {}
  ): Promise<UnsubscribeInterface> {
    config.immediate = false; // 所有用 auto$ 进行的订阅，均不主动触发首次订阅，由队列函数去主动触发
    if (undefined === runtime.readModelInternalItemDependencies[this.options.name]) {
      runtime.readModelInternalItemDependencies[this.options.name] = {};
    }
    const id = auto$nextId++;
    runtime.readModelInternalItemDependencies[this.options.name][id] = [];

    await subClosFunc();

    const unsubscribeFuncArr = runtime.readModelInternalItemDependencies[this.options.name][id].map((item) => {
      return item.subscribe(subClosFunc, config);
    });
    delete runtime.readModelInternalItemDependencies[this.options.name][id];
    return () => {
      unsubscribeFuncArr.forEach((unsubscribe) => unsubscribe());
    };
  }
}
