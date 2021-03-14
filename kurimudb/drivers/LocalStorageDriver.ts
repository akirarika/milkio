import { PersistenceInterface } from "..";

export default class LocalStorageDriver implements PersistenceInterface {
  async: boolean = false; // if true, some functions can return Promise.
  encode: boolean = true; // if true, value will be encoded.
  primary: string; // model primary, all data received by the driver are objects.
  name: string; // the name of the model.
  db: any; // dexie object injected in by user.

  constructor(name: string, primary: string, inject: any) {
    this.name = name;
    this.primary = primary;
    this.db = inject;
  }

  insert(value: any, key?: string | number): any {
    if (!key) {
      let id = localStorage.getItem(`$table_id__${this.name}`);
      if (!id) id = "1";
      key = parseInt(id);
      localStorage.setItem(`$table_id__${this.name}`, `${key + 1}`);
    }
    localStorage.setItem(`$table__${this.name}_${key}`, JSON.stringify(value));
  }

  insertOrUpdate(key: string | number, value: any): void {
    localStorage.setItem(`$table__${this.name}_${key}`, JSON.stringify(value));
  }

  update(key: string | number, value: any): void {
    localStorage.setItem(`$table__${this.name}_${key}`, JSON.stringify(value));
  }

  select(key: string | number): any {
    return JSON.parse("" + localStorage.getItem(`$table__${this.name}_${key}`));
  }

  exists(key: string | number): boolean {
    return Boolean(localStorage.getItem(`$table__${this.name}_${key}`));
  }

  delete(key: string | number): void {
    localStorage.removeItem(`$table__${this.name}_${key}`);
  }

  seeding(seeding: Function, model: any) {
    if (localStorage.getItem(`$seeded__${this.name}`)) return;
    seeding(model);
    localStorage.setItem(`$seeded__${this.name}`, "1");
  }

  all() {
    throw new Error(`The localstorage driver cannot use the 'all' method.`);

    return [];
  }
}
