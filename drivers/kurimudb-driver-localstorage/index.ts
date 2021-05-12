export class LocalStorageDriver {
  model;

  constructor(model) {
    this.model = model;
  }

  insert(value: any, key?: string | number): string | number {
    if (!key) {
      // 如果没有 key, 代表用户想插入一个主键自增的数据
      let id = localStorage.getItem(`$table_id__${this.model.options.name}`);
      if (!id) id = "1";
      key = parseInt(id);
      localStorage.setItem(
        `$table_id__${this.model.options.name}`,
        `${key + 1}`
      );
    }
    localStorage.setItem(
      `$table__${this.model.options.name}_${key}`,
      JSON.stringify(value)
    );
    this._addModelIndex(key);

    return key;
  }

  insertOrUpdate(key: string | number, value: any): void {
    localStorage.setItem(
      `$table__${this.model.options.name}_${key}`,
      JSON.stringify(value)
    );
    this._addModelIndex(key);
  }

  update(key: string | number, value: any): void {
    localStorage.setItem(
      `$table__${this.model.options.name}_${key}`,
      JSON.stringify(value)
    );
    this._addModelIndex(key);
  }

  select(key: string | number): any {
    return JSON.parse(
      "" + localStorage.getItem(`$table__${this.model.options.name}_${key}`)
    );
  }

  exists(key: string | number): boolean {
    return Boolean(
      localStorage.getItem(`$table__${this.model.options.name}_${key}`)
    );
  }

  delete(key: string | number): void {
    localStorage.removeItem(`$table__${this.model.options.name}_${key}`);
    this._deleteModelIndex(key);
  }

  seeding(seeding: Function, model) {
    if (localStorage.getItem(`$seeded__${this.model.options.name}`)) return;
    seeding(model);
    localStorage.setItem(`$seeded__${this.model.options.name}`, "1");
  }

  all() {
    const index = localStorage.getItem(`$index__${this.model.options.key}`);
    if (!index) return {};
    const indexArr = JSON.parse(index);
    const rtnAllData = {};
    for (const item of indexArr) {
      rtnAllData[item] = this.select(item);
    }
    return rtnAllData;
  }

  _addModelIndex(key: string | number) {
    if ("collection" !== this.model.options.modelType) return;

    let index = localStorage.getItem(`$index__${this.model.options.key}`);

    let indexArr;
    if (index) indexArr = JSON.parse(index);
    else indexArr = [];

    if (-1 !== indexArr.indexOf(key)) return;
    indexArr.push(key);
    localStorage.setItem(
      `$index__${this.model.options.key}`,
      JSON.stringify(indexArr)
    );
  }

  _deleteModelIndex(key: string | number) {
    if ("collection" !== this.model.options.modelType) return;

    let index = localStorage.getItem(`$index__${this.model.options.key}`);
    if (!index) return;
    const indexArr = JSON.parse(index);
    const indexOf = indexArr.indexOf(key);
    if (-1 === indexOf) return;
    indexArr.splice(indexOf, 1);
    localStorage.setItem(
      `$index__${this.model.options.key}`,
      JSON.stringify(indexArr)
    );
  }
}
