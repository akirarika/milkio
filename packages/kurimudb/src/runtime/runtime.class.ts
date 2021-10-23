import { CacheItem } from "../cache/cache-item.class";

export class Runtime {
  readItemDependencies?: Array<CacheItem>;
  readModelInternalItemDependencies: Record<string, Record<number, Array<CacheItem>>> = {};
}
