import { Table } from "dexie";
import { PersistenceInterface } from "..";

export default class DexieDriver implements PersistenceInterface {
  async: boolean = true; // if true, some functions can return Promise.
  encode: boolean = true; // if true, value will be encoded.
  primary: string; // model primary, all data received by the driver are objects.
  name: string; // the name of the model.
  db: any; // dexie object injected in by user.

  constructor(name: string, primary: string, inject: any) {
    this.name = name;
    this.primary = primary;
    this.db = inject;
  }

  async insert(value: any, key?: string | number): Promise<any> {
    return await this._table().add(value);
  }

  async insertOrUpdate(key: string | number, value: any): Promise<void> {
    await this._table().put(value);
  }

  async update(key: string | number, value: any): Promise<void> {
    await this._table().put(value);
  }

  async select(key: string | number): Promise<any> {
    return await this._table().get(key);
  }

  async exists(key: string | number): Promise<boolean> {
    return Boolean(
      await this._table()
        .where(this.primary)
        .equals(key)
        .count()
    );
  }

  async delete(key: string | number): Promise<void> {
    await this._table().delete(key);
  }

  async seeding(seedingFunc: Function, model: any) {
    const table = this.db["_seed"];
    if (await table.get(`${this.name}_is_seeded`)) return;
    await table.add({
      id: `${this.name}_is_seeded`,
      value: `true`,
    });
    await seedingFunc(model);
  }

  query(): Table {
    return this._table();
  }

  all() {
    return this._table().toArray();
  }

  _table() {
    const table = this.db[this.name];
    if (table) return table;
    throw new Error(
      `table "${this.name}" does not exist in the database. did you forget to add the new version?`
    );
  }
}
