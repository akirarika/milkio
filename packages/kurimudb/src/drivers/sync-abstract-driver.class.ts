import { BaseModel } from "../models/sync/base-model.class";

export interface SyncAbstractDriverStorageInterface {
  all(): Record<string, unknown>;
  insert(key: string, value: unknown): boolean;
  insertAutoIncrement(value: unknown): string;
  update(key: string, value: unknown): boolean;
  insertOrUpdate(key: string, value: unknown): void;
  select(key: string): unknown | undefined;
  exists(key: string): boolean;
  delete(key: string): boolean;
  bulkInsert(items: Record<string, unknown>): boolean;
  bulkInsertAutoIncrement(items: Array<unknown>): Array<string>;
  bulkUpdate(items: Record<string, unknown>): boolean;
  bulkInsertOrUpdate(items: Record<string, unknown>): void;
  bulkSelect(keys: Array<string>): Record<string, unknown | undefined>;
  bulkDelete(keys: Array<string>): boolean;
  seeding(seeding: Function): void;
  clone(value: unknown): unknown;
}

export abstract class SyncAbstractDriver {
  abstract make<DataType, DriverType extends SyncAbstractDriver>(
    model: BaseModel<DataType, DriverType>
  ): SyncAbstractDriverStorageInterface;
}
