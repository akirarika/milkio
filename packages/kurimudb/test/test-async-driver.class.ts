import { makeKMap, AsyncAbstractDriverFactory, AsyncAbstractDriverInterface, SyncAbstractDriverInterface } from "../src";
import { KMap } from "../src/helpers/make-kurimudb-map.func";
import { BaseModel } from "../src/models/async/base-model.class";

let nextPrimaryKey = 1;

const data: KMap<KMap<unknown>> = makeKMap<KMap<unknown>>();

export interface TestAsyncDriver extends AsyncAbstractDriverInterface {
}

const delay = (val?: any): Promise<any> => new Promise((r) => setTimeout(() => r(val), Math.floor(10 * Math.random())));

class TestAsyncDriverFactory extends AsyncAbstractDriverFactory {
  make<DataType, DriverType extends SyncAbstractDriverInterface | AsyncAbstractDriverInterface | undefined>(
    model: BaseModel<DataType, DriverType>
  ): AsyncAbstractDriverInterface {
    const options = model.options;
    data[options.name] = makeKMap<unknown>();

    const product: AsyncAbstractDriverInterface = {
      async insert(key: string, value: unknown): Promise<boolean> {
        await delay();

        if (key in data[options.name]) {
          // Primary key exists.
          return false;
        }

        data[options.name][key] = value;

        return true;
      },

      async update(key: string, value: unknown): Promise<boolean> {
        await delay();

        if (!(key in data[options.name])) {
          // Primary key does not exist.
          return false;
        }

        data[options.name][key] = value;

        return true;
      },

      async insertOrUpdate(key: string, value: unknown): Promise<void> {
        await delay();

        if (key in data[options.name]) {
          await product.update(key, value);
          return;
        } else {
          await product.insert(key, value);
          return;
        }
      },

      async insertAutoIncrement(value: unknown): Promise<string> {
        await delay();

        const primaryKey = String(nextPrimaryKey++);
        if (primaryKey in data[options.name]) {
          throw new Error(`Primary key exists.`);
        }
        data[options.name][primaryKey] = value;

        return primaryKey;
      },

      async select(key: string): Promise<unknown | undefined> {
        await delay();

        return data[options.name][key];
      },

      async exists(key: string): Promise<boolean> {
        await delay();

        return key in data[options.name];
      },

      async delete(key: string): Promise<boolean> {
        await delay();

        if (!(key in data[options.name])) {
          // Primary key does not exist.
          return false;
        }
        delete data[options.name][key];

        return true;
      },

      async bulkInsert(items: Record<string, unknown>): Promise<boolean> {
        await delay();

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

      async bulkInsertAutoIncrement(items: Array<unknown>): Promise<Array<string>> {
        await delay();

        // It is necessary to ensure that batch data processing will succeed before operation.
        // or you can roll back the data after an error occurs (the latter is more recommended for indexeddb).
        const results: Array<string> = [];
        for (const item of items) {
          results.push(await product.insertAutoIncrement(item));
        }
        return results;
      },

      async bulkUpdate(items: Record<string, unknown>): Promise<boolean> {
        await delay();

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

      async bulkInsertOrUpdate(items: Record<string, unknown>): Promise<boolean> {
        await delay();

        // It is necessary to ensure that batch data processing will succeed before operation.
        // or you can roll back the data after an error occurs (the latter is more recommended for indexeddb).
        for (const key in items) {
          data[options.name][key] = items[key];
        }

        return true;
      },

      async bulkSelect(keys: Array<string>): Promise<KMap<unknown>> {
        await delay();

        const results: KMap<unknown> = makeKMap<unknown>();
        for (const key of keys) {

          results[key] = await product.select(key);
        }
        return results;
      },

      async bulkDelete(keys: Array<string>): Promise<boolean> {
        await delay();

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

      async seeding(seeding: Function): Promise<void> {
        await delay();

        await seeding();
      },

      async clone(value: unknown): Promise<unknown> {
        await delay();

        return value;
      },
    };

    return product;
  }
}

export const testAsyncDriverFactory = new TestAsyncDriverFactory();