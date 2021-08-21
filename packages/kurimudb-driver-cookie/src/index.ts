export class CookieDriver {
  model;

  constructor(model) {
    this.model = model;
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

  seeding(seeding: Function, model) {
    throw new Error(`The cookie driver cannot use the 'seeding' method.`);
  }

  all(): never {
    throw new Error(`The cookie driver cannot use the 'all' method.`);
  }
}

function setCookie(name: string | number, value: any) {
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

function getCookie(name: string | number) {
  if (document.cookie.length > 0) {
    let end: number;
    let start = document.cookie.indexOf(name + "=");

    if (start != -1) {
      start = start + String(name).length + 1;
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

function delCookie(name: string | number) {
  let exp = new Date();
  exp.setTime(exp.getTime() - 1);
  let cval = getCookie(name);
  if (cval != null) document.cookie = name + "=" + cval + ";max-age=0";
}
