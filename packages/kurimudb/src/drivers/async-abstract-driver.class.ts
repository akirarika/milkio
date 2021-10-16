import { SyncAbstractDriverFactory, SyncAbstractDriverInterface } from "..";
import { KurimudbMap } from "../helpers/make-kurimudb-map.func";
import { BaseModel } from "../models/async/base-model.class";

export interface AsyncAbstractDriverInterface {
  all(): KurimudbMap<unknown>;
  insert(key: string, value: unknown): Promise<boolean>;
  insertAutoIncrement(value: unknown): Promise<string>;
  update(key: string, value: unknown): Promise<boolean>;
  insertOrUpdate(key: string, value: unknown): Promise<void>;
  select(key: string): Promise<unknown | undefined>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  bulkInsert(items: Record<string, unknown>): Promise<boolean>;
  bulkInsertAutoIncrement(items: Array<unknown>): Promise<Array<string>>;
  bulkUpdate(items: Record<string, unknown>): Promise<boolean>;
  bulkInsertOrUpdate(items: Record<string, unknown>): Promise<boolean>;
  bulkSelect(keys: Array<string>): Promise<KurimudbMap<unknown>>;
  bulkDelete(keys: Array<string>): Promise<boolean>;
  seeding(seeding: Function): Promise<void>;
  clone(value: unknown): Promise<unknown>;
}

export abstract class AsyncAbstractDriverFactory {
  abstract make<DataType, DriverType extends SyncAbstractDriverInterface | AsyncAbstractDriverInterface | undefined>(
    model: BaseModel<DataType, DriverType>
  ): AsyncAbstractDriverInterface;
}
