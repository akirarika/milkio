import { getStorageSync, setStorageSync } from "@tarojs/taro";
export class TaroDriver {
  model;

  constructor(model) {
    this.model = model;
  }

  insert(value: any, key?: string | number): string | number {
    if (!key) {
      // 如果没有 key, 代表用户想插入一个主键自增的数据
      let id = getStorageSync(`$table_id__${this.model.options.name}`);
      if (!id) id = "1";
      key = parseInt(id);
      setStorageSync(`$table_id__${this.model.options.name}`, `${key + 1}`);
    }
    setStorageSync(
      `$table__${this.model.options.name}_${key}`,
      JSON.stringify(value)
    );

    return key;
  }

  insertOrUpdate(key: string | number, value: any): void {
    setStorageSync(
      `$table__${this.model.options.name}_${key}`,
      JSON.stringify(value)
    );
  }

  update(key: string | number, value: any): void {
    setStorageSync(
      `$table__${this.model.options.name}_${key}`,
      JSON.stringify(value)
    );
  }

  select(key: string | number): any {
    return JSON.parse(
      "" + getStorageSync(`$table__${this.model.options.name}_${key}`)
    );
  }

  exists(key: string | number): boolean {
    return Boolean(getStorageSync(`$table__${this.model.options.name}_${key}`));
  }

  delete(key: string | number): void {
    localStorage.removeItem(`$table__${this.model.options.name}_${key}`);
  }

  seeding(seeding: Function, model) {
    if (getStorageSync(`$seeded__${this.model.options.name}`)) return;
    seeding(model);
    setStorageSync(`$seeded__${this.model.options.name}`, "1");
  }

  all() {
    throw new Error(`The localstorage driver cannot use the 'all' method.`);
    return [];
  }
}
