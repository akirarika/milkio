import { Item } from "./item.class";

export class Cache {
  private model;
  public value: Map<string | number, Item> = new Map();

  constructor(model) {
    this.model = model;
  }

  all(): object {
    const result = {};
    for (const [key, value] of this.value.entries()) result[key] = value.get();
    return result;
  }

  subscribe(key) {
    if (this.value.has(key)) return this.value.get(key)?.subscribe;
    this.value.set(key, this.createCacheItem(void 0, key));
    return this.value.get(key)?.subscribe;
  }

  get(key, def = void 0) {
    if (!this.value.has(key)) {
      this.value.set(key, this.createCacheItem(def, key));
    }
    return this.value.get(key)?.get();
  }

  add(key, value) {
    if (this.value.has(key))
      throw new Error(`Key already exists in the object store.`);
    this.value.set(key, this.createCacheItem(this.model.deepClone(value), key));
  }

  put(key, value) {
    if (this.value.has(key))
      this.value.get(key)?.set(this.model.deepClone(value));
    else
      this.value.set(
        key,
        this.createCacheItem(this.model.deepClone(value), key)
      );
  }

  forget(key) {
    this.value.get(key)?.forget();
    this.value.delete(key);
  }

  has(key): boolean {
    return this.value.has(key);
  }

  count() {
    return this.value.size;
  }

  createCacheItem<T = any>(value, key) {
    return new Item<T>(value, key);
  }
}
