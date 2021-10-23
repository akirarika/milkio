import { makeKMap, SyncAbstractDriverFactory, SyncAbstractDriverInterface } from "../src";
import { KMap } from "../src/helpers/make-kurimudb-map.func";
import { BaseModel } from "../src/models/sync/base-model.class";

let nextPrimaryKey = 1;

const data: KMap<KMap<unknown>> = makeKMap<KMap<unknown>>();

export interface TestSyncDriver extends SyncAbstractDriverInterface {
}

class TestSyncDriverFactory extends SyncAbstractDriverFactory {
  make<DataType, DriverType extends SyncAbstractDriverInterface | undefined>(
    model: BaseModel<DataType, DriverType>
  ): TestSyncDriver {
    const options = model.options;
    data[options.name] = makeKMap<unknown>();

    const product: SyncAbstractDriverInterface = {
      insert(key: string, value: unknown): boolean {
        if (key in data[options.name]) {
          // Primary key exists.
          return false;
        }

        data[options.name][key] = value;

        return true;
      },

      update(key: string, value: unknown): boolean {
        if (!(key in data[options.name])) {
          // Primary key does not exist.
          return false;
        }

        data[options.name][key] = value;

        return true;
      },

      insertOrUpdate(key: string, value: unknown): void {
        if (key in data[options.name]) {
          product.update(key, value);
          return;
        } else {
          product.insert(key, value);
          return;
        }
      },

      insertAutoIncrement(value: unknown): string {
        const primaryKey = String(nextPrimaryKey++);
        if (primaryKey in data[options.name]) {
          throw new Error(`Primary key exists.`);
        }
        data[options.name][primaryKey] = value;

        return primaryKey;
      },

      select(key: string): unknown | undefined {
        return data[options.name][key];
      },

      exists(key: string): boolean {
        return key in data[options.name];
      },

      delete(key: string): boolean {
        if (!(key in data[options.name])) {
          // Primary key does not exist.
          return false;
        }
        delete data[options.name][key];

        return true;
      },

      bulkInsert(items: Record<string, unknown>): boolean {
        // It is necessary to ensure that batch data processing will succeed before operation.
        // or you can roll back the data after an error occurs (the latter is more recommended for indexeddb).
        for (const key in items) {
          if (key in data[options.name]) return false;
        }
        for (const key in items) {
          data[options.name][key] = items[key];
        }
        return true;
      },

      bulkInsertAutoIncrement(items: Array<unknown>): Array<string> {
        // It is necessary to ensure that batch data processing will succeed before operation.
        // or you can roll back the data after an error occurs (the latter is more recommended for indexeddb).
        const results: Array<string> = [];
        for (const item of items) {
          results.push(product.insertAutoIncrement(item));
        }
        return results;
      },

      bulkUpdate(items: Record<string, unknown>): boolean {
        // It is necessary to ensure that batch data processing will succeed before operation.
        // or you can roll back the data after an error occurs (the latter is more recommended for indexeddb).
        for (const key in items) {
          if (!(key in data[options.name])) return false;
        }
        for (const key in items) {
          data[options.name][key] = items[key];
        }
        return true;
      },

      bulkInsertOrUpdate(items: Record<string, unknown>): boolean {
        // It is necessary to ensure that batch data processing will succeed before operation.
        // or you can roll back the data after an error occurs (the latter is more recommended for indexeddb).
        for (const key in items) {
          data[options.name][key] = items[key];
        }

        return true;
      },

      bulkSelect(keys: Array<string>): KMap<unknown> {
        const results: KMap<unknown> = makeKMap<unknown>();
        for (const key of keys) {

          results[key] = product.select(key);
        }
        return results;
      },

      bulkDelete(keys: Array<string>): boolean {
        // It is necessary to ensure that batch data processing will succeed before operation.
        // or you can roll back the data after an error occurs (the latter is more recommended for indexeddb).
        for (const key of keys) {
          if (!(key in data[options.name])) return false;
        }
        for (const key of keys) {
          delete data[options.name][key];
        }
        return true;
      },

      seeding(seeding: Function): void {
        seeding();
      },

      clone(value: unknown): unknown {
        return value;
      },
    };

    return product;
  }
}

export const testSyncDriverFactory = new TestSyncDriverFactory();