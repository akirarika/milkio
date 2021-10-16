import { CacheFactory } from "./cache/cache-factory.class";
import { DataFactory as SyncDataFactory } from "./data/sync/data-factory.class";
import { DataFactory as AsyncDataFactory } from "./data/async/data-factory.class";
import { GlobalConfig } from "./global-config/global-config.class";
import { Runtime } from "./runtime/runtime.class";

export const runtime = new Runtime();
export const cacheFactory = new CacheFactory();
export const syncDataFactory = new SyncDataFactory();
export const asyncDataFactory = new AsyncDataFactory();
// export const asyncDataFactory = new AsyncDataFactory();
export const globalConfig = new GlobalConfig();
