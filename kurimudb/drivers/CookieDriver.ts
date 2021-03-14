import { PersistenceInterface } from "..";

function setCookie(name, value) {
  document.cookie =
    name +
    "=" +
    encodeURIComponent(
      "object" === typeof value ? JSON.stringify(value) : value
    ) +
    ";max-age=" +
    31525459200 +
    ";path=/";
}

function getCookie(name) {
  if (document.cookie.length > 0) {
    let end;
    let start = document.cookie.indexOf(name + "=");

    if (start != -1) {
      start = start + name.length + 1;
      end = document.cookie.indexOf(";", start);
      if (end == -1) end = document.cookie.length;
      let value = decodeURIComponent(document.cookie.substring(start, end));
      try {
        value = JSON.parse(value);
      } catch (error) {}
      return value;
    }
  }
  return null;
}

function delCookie(name) {
  let exp = new Date();
  exp.setTime(exp.getTime() - 1);
  let cval = getCookie(name);
  if (cval != null) document.cookie = name + "=" + cval + ";max-age=0";
}

export default class LocalStorageDriver implements PersistenceInterface {
  async: boolean = false; // if true, some functions can return Promise.
  encode: boolean = false; // if true, value will be encoded.
  primary: string; // model primary, all data received by the driver are objects.
  name: string; // the name of the model.
  db: any; // dexie object injected in by user.

  constructor(name: string, primary: string, inject: any) {
    this.name = name;
    this.primary = primary;
    this.db = inject;
  }

  insert(value: any, key?: string | number): any {
    if (!key)
      throw new Error(
        `You must pass in the primary key! (Cookie driver does not support collection model)`
      );
    setCookie(key, value);
  }

  insertOrUpdate(key: string | number, value: any): void {
    setCookie(key, value);
  }

  update(key: string | number, value: any): void {
    setCookie(key, value);
  }

  select(key: string | number): any {
    return getCookie(key);
  }

  exists(key: string | number): boolean {
    return Boolean(getCookie(key));
  }

  delete(key: string | number): void {
    delCookie(key);
  }

  seeding(seeding: Function, model: any) {
    if (getCookie(`$seeded__${this.name}`)) return;
    seeding(model);
    setCookie(`$seeded__${this.name}`, "1");
  }

  all() {
    throw new Error(`The cookie driver cannot use the 'all' method.`);

    return [];
  }
}
