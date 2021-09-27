import { CacheItem } from "../cache/cache-item.class";

export class Runtime {
  readItemDependencies: Array<CacheItem> = [];
  collectingReadItemDependencies = false;
}
