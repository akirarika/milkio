import Dexie, { DexieError, Table } from "dexie";
import {
  makeKMap,
  AsyncAbstractDriverFactory,
  AsyncAbstractDriverInterface,
  KMap,
  AsyncBaseModel,
  clone,
  SyncAbstractDriverInterface,
} from "kurimudb";

export interface DexieDriver extends AsyncAbstractDriverInterface {
  query(): Table;
  getPrimaryName(): string;
  restorePrimaryType(key: string): number | string;
  all(): Promise<KMap<any>>;
  getLength(): Promise<number>;
}

class DexieDriverFactory extends AsyncAbstractDriverFactory {
  make<
    DataType,
    DriverType extends
      | AsyncAbstractDriverInterface
      | SyncAbstractDriverInterface
      | undefined
  >(model: AsyncBaseModel<DataType, DriverType>) {
    const options = model.options;
    if (undefined === options?.db)
      throw new Error(
        `[Kurimudb] The "db" parameter was not passed in the Model constructor, this param is required when using DexieDriver.`
      );

    const db = options.db as Dexie;

    const encode = (value: unknown): Record<string, unknown> => {
      let proto = value;
      while (Object.getPrototypeOf(proto) !== null) {
        proto = Object.getPrototypeOf(proto);
      }
      if (Object.getPrototypeOf(value) === proto) {
        return value as Record<string, unknown>;
      } else {
        const data = Object.create(null);

        return {
          $__value: value,
        };
      }
    };

    const decode = (value: Record<string, unknown>) => {
      if ("object" === typeof value && "$__value" in value) {
        value;
        return value["$__value"];
      } else {
        return value;
      }
    };

    const product: DexieDriver = {
      query(): Table {
        return db.table(options.name);
      },

      getPrimaryName(): string {
        return this.query().schema.primKey.name;
      },

      restorePrimaryType(key: string): number | string {
        let rkey: string | number = Number(key);
        if (isNaN(rkey)) rkey = key;
        return rkey;
      },

      insert(key: string, value: unknown): Promise<boolean> {
        return new Promise((resolve, reject) => {
          this.query()
            .add(encode(value), this.restorePrimaryType(key))
            .then(() => resolve(true))
            .catch((error) => {
              if ("ConstraintError" === error?.name) resolve(false);
              else reject(error);
            });
        });
      },

      async update(key: string, value: unknown): Promise<boolean> {
        return (
          1 ===
          (await this.query().update(
            this.restorePrimaryType(key),
            encode(value)
          ))
        );
      },

      async insertOrUpdate(key: string, value: unknown): Promise<void> {
        const data = encode(value);
        data[this.getPrimaryName()] = this.restorePrimaryType(key);
        await this.query().put(data);
      },

      async insertAutoIncrement(value: unknown): Promise<string> {
        return String(await this.query().add(encode(value)));
      },

      async select(key: string): Promise<unknown | undefined> {
        return decode(await this.query().get(this.restorePrimaryType(key)));
      },

      async exists(key: string): Promise<boolean> {
        return (
          (await this.query()
            .where(this.getPrimaryName())
            .equals(this.restorePrimaryType(key))
            .count()) > 0
        );
      },

      async delete(key: string): Promise<boolean> {
        await this.query().delete(key);

        return true;
      },

      bulkInsert(items: Record<string, unknown>): Promise<boolean> {
        const itemsArr: Array<unknown> = [];
        for (const key in items) {
          const item = encode(items[key]);
          item[this.getPrimaryName()] = this.restorePrimaryType(key);
          itemsArr.push(item);
        }

        return new Promise((resolve, reject) => {
          db.transaction("rw", this.query(), async () => {
            await this.query().bulkAdd(itemsArr);
            resolve(true);
          }).catch((error) => {
            if ("BulkError" !== error?.name) throw error;
          });
        });
      },

      bulkInsertAutoIncrement(items: Array<unknown>): Promise<Array<string>> {
        const itemsArr: Array<unknown> = [];
        for (const key in items) {
          const item = encode(items[key]);
          itemsArr.push(item);
        }

        return new Promise((resolve, reject) => {
          db.transaction("rw", this.query(), async () => {
            resolve(
              (await this.query().bulkAdd(itemsArr, { allKeys: true })).map(
                (v) => String(v)
              )
            );
          }).catch((error) => {
            if ("BulkError" !== error?.name) throw error;
          });
        });
      },

      async bulkUpdate(items: Record<string, unknown>): Promise<boolean> {
        const itemsArr: Array<unknown> = [];
        for (const key in items) {
          const item = encode(items[key]);
          item[this.getPrimaryName()] = this.restorePrimaryType(key);
          itemsArr.push(item);
        }

        return new Promise((resolve, reject) => {
          db.transaction("rw", this.query(), async () => {
            await this.query().bulkPut(itemsArr);
            resolve(true);
          }).catch((error) => {
            if ("BulkError" !== error?.name) throw error;
          });
        });
      },

      async bulkInsertOrUpdate(
        items: Record<string, unknown>
      ): Promise<boolean> {
        const itemsArr: Array<unknown> = [];
        for (const key in items) {
          const item = encode(items[key]);
          item[this.getPrimaryName()] = this.restorePrimaryType(key);
          itemsArr.push(item);
        }

        return new Promise((resolve, reject) => {
          db.transaction("rw", this.query(), async () => {
            await this.query().bulkPut(itemsArr);
            resolve(true);
          }).catch((error) => {
            if ("BulkError" !== error?.name) throw error;
          });
        });
      },

      async bulkSelect(keys: Array<string>): Promise<KMap<unknown>> {
        const res = await this.query().bulkGet(
          keys.map((v) => this.restorePrimaryType(v))
        );

        const data = makeKMap();
        for (let index = 0; index < keys.length; index++) {
          data[keys[index]] = decode(res[index]);
        }

        return data;
      },

      async bulkDelete(keys: Array<string>): Promise<boolean> {
        await this.query().bulkDelete(
          keys.map((v) => this.restorePrimaryType(v))
        );

        return true;
      },

      async seeding(seeding: Function): Promise<void> {
        const table = db.table("_seed");
        if (await table.get(`${options.name}_is_seeded`)) return;

        await table.add({
          _id: `${options.name}_is_seeded`,
          value: `true`,
        });
        await seeding(model);
      },

      async clone(value: unknown): Promise<unknown> {
        return clone(value);
      },

      async all(): Promise<KMap<any>> {
        const res = makeKMap();
        (await this.query().toArray()).forEach((value) => {
          res[value[this.getPrimaryName()]] = decode(value);
        });
        return res;
      },

      async getLength(): Promise<number> {
        return this.query().count();
      },
    };

    return product;
  }
}

export const dexieDriverFactory = new DexieDriverFactory();
