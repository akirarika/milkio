import {
  SyncAbstractDriver,
  SyncAbstractDriverStorageInterface,
} from "../../drivers/sync-abstract-driver.class";
import { ModelOptionsInterface } from "../model-options.interface";
import { cacheFactory, syncDataFactory } from "../../providers";
import { DataProxyType } from "../../data/sync/data-factory.class";
import { SubscribeInterface } from "../../cache/subscribe.interface";
import { KurimudbMap, makeKurimudbMap } from "../../helpers/make-kurimudb-map.func";

export class BaseModel<
  DataType extends Record<string, any>,
  DriverType extends SyncAbstractDriver
  > {
  public options: ModelOptionsInterface;
  public cache;
  public $: SubscribeInterface;
  public data: DataProxyType<DataType>;
  public storage: SyncAbstractDriverStorageInterface | undefined;

  constructor(options: ModelOptionsInterface) {
    this.options = this.checkOptions(options);

    this.cache = cacheFactory.make<DataType, DriverType>(this);
    this.$ = this.cache.changed.subscribe;
    this.data = syncDataFactory.make<DataType, DriverType>(this);
    if (options.driver) {
      this.storage = options.driver.make<DataType, DriverType>(this);
    }
  }

  private checkOptions(options: ModelOptionsInterface): ModelOptionsInterface {
    if (!options.name) throw new Error(`The model "name" does not exist.`);
    if (!options.ioType || !options.modelType) {
      throw new Error(
        `The model "ioType" or "modelType" does not exist. Do you inherit "BaseModel"? Please don't do that.`
      );
    }

    options.primary = options.primary ?? "_id";
    options.async = options.async ?? false;

    return options;
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
      const results = makeKurimudbMap<DataType[Key]>();
      for (const key of keys) {
        const skey = String(key);
        results[skey] = this.cache.get(skey) as DataType[Key];
      }
      return results;
    } else {
      const results = makeKurimudbMap<DataType[Key]>();
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
    const skey = String(key);
    if (undefined !== this.storage) {
      if (false === this.storage.insert(skey, value)) return false;
    }
    this.cache.put(skey, value);
    return true;
  }

  bulkAddItem<Key extends keyof DataType>(items: Record<Key, DataType[Key]>): boolean {
    const skeyItems = makeKurimudbMap<unknown>();
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
    const skey = String(key);
    this.cache.put(skey, value);
    if (undefined === this.storage) return;
    this.storage.insertOrUpdate(skey, value);
  }

  bulkSetItem<Key extends keyof DataType>(items: Record<Key, DataType[Key]>): boolean {
    const skeyItems = makeKurimudbMap<unknown>();
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

  subscribeItem<Key extends keyof DataType>(key: Key) {
    const skey = String(key);
    return this.cache.subscribe(skey);
  }
}
