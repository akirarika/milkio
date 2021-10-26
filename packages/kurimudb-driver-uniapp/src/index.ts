import {
  makeKMap,
  SyncAbstractDriverFactory,
  SyncAbstractDriverInterface,
  KMap,
  SyncBaseModel,
  clone,
} from "kurimudb";
import { setStorageSync, getStorageSync } from '@tarojs/taro'

export interface TaroDriver extends SyncAbstractDriverInterface {
  all(): KMap<any>;
  getLength(): number;
  getKeys(): Array<string>;
}

class TaroDriverFactory extends SyncAbstractDriverFactory {
  make<DataType, DriverType extends SyncAbstractDriverInterface | undefined>(
    model: SyncBaseModel<DataType, DriverType>
  ) {
    const options = model.options;

    const addIndex = (key: string) => {
      if ("collection" !== options.modelType) return;
      let index = getStorageSync(`$index__${options.name}`);
      let indexArr: Array<string>;
      if (index) {
        indexArr = JSON.parse(index);
      } else {
        indexArr = [];
      }
      if (-1 !== indexArr.indexOf(key)) return;
      indexArr.push(key);
      setStorageSync(`$index__${options.name}`, JSON.stringify(indexArr));
    };

    const product: TaroDriver = {
      insert(key: string, value: unknown): boolean {
        if ('' !== getStorageSync(`$table__${options.name}_${key}`))
          return false;

        setStorageSync(
          `$table__${options.name}_${key}`,
          JSON.stringify(value)
        );
        addIndex(key);

        return true;
      },

      update(key: string, value: unknown): boolean {
        if ('' === getStorageSync(`$table__${options.name}_${key}`))
          return false;

        setStorageSync(
          `$table__${options.name}_${key}`,
          JSON.stringify(value)
        );
        addIndex(key);

        return true;
      },

      insertOrUpdate(key: string, value: unknown): void {
        setStorageSync(
          `$table__${options.name}_${key}`,
          JSON.stringify(value)
        );
        addIndex(key);
      },

      insertAutoIncrement(value: unknown): string {
        let key;
        if (undefined !== options.autoIncrementHandler) {
          key = options.autoIncrementHandler(options);
        } else {
          key = getStorageSync(`$table_id__${options.name}`);
          if ('' === key) key = "1";
          setStorageSync(
            `$table_id__${options.name}`,
            `${parseInt(key) + 1}`
          );
        }
        setStorageSync(
          `$table__${options.name}_${key}`,
          JSON.stringify(value)
        );
        addIndex(key);

        return key;
      },

      select(key: string): unknown | undefined {
        const raw = getStorageSync(`$table__${options.name}_${key}`);
        if ('' === raw) return undefined;
        return JSON.parse(raw);
      },

      exists(key: string): boolean {
        return '' !== getStorageSync(`$table__${options.name}_${key}`);
      },

      delete(key: string): boolean {
        localStorage.removeItem(`$table__${options.name}_${key}`);

        if ("collection" !== options.modelType) return true;

        let index = getStorageSync(`$index__${options.name}`);
        if (!index) return true;
        const indexArr = JSON.parse(index);
        const indexOf = indexArr.indexOf(key);
        if (-1 === indexOf) return true;
        indexArr.splice(indexOf, 1);
        setStorageSync(
          `$index__${options.name}`,
          JSON.stringify(indexArr)
        );
        return true;
      },

      bulkInsert(items: Record<string, unknown>): boolean {
        for (const key in items) {
          if ('' !== getStorageSync(`$table__${options.name}_${key}`))
            return false;
        }
        for (const key in items) {
          setStorageSync(
            `$table__${options.name}_${key}`,
            JSON.stringify(items[key])
          );
        }
        return true;
      },

      bulkInsertAutoIncrement(items: Array<unknown>): Array<string> {
        const keys: Array<string> = [];

        if (0 === items.length) return [];

        if (undefined !== options.autoIncrementHandler) {
          for (const iterator of items) {
            keys.push(options.autoIncrementHandler(options));
          }
        } else {
          let key = getStorageSync(`$table_id__${options.name}`);
          if ('' === key) key = "1";
          setStorageSync(
            `$table_id__${options.name}`,
            `${parseInt(key) + items.length - 1}`
          );
          for (let i = parseInt(key); i < parseInt(key) + items.length; i++) {
            keys.push(`${i}`);
          }
        }
        for (let index = 0; index < items.length; index++) {
          setStorageSync(
            `$table__${options.name}_${keys[index]}`,
            JSON.stringify(items[index])
          );
          addIndex(keys[index]);
        }

        return keys;
      },

      bulkUpdate(items: Record<string, unknown>): boolean {
        for (const key in items) {
          if ('' === getStorageSync(`$table__${options.name}_${key}`))
            return false;
        }
        for (const key in items) {
          setStorageSync(
            `$table__${options.name}_${key}`,
            JSON.stringify(items[key])
          );
        }
        return true;
      },

      bulkInsertOrUpdate(items: Record<string, unknown>): boolean {
        for (const key in items) {
          setStorageSync(
            `$table__${options.name}_${key}`,
            JSON.stringify(items[key])
          );
        }
        return true;
      },

      bulkSelect(keys: Array<string>): KMap<unknown> {
        const data = makeKMap();
        for (let index = 0; index < keys.length; index++) {
          const key = keys[index];
          const raw = getStorageSync(`$table__${options.name}_${key}`);
          if ('' === raw) {
            data[key] = undefined;
            continue;
          }
          data[key] = JSON.parse(raw);
        }

        return data;
      },

      bulkDelete(keys: Array<string>): boolean {
        for (let index = 0; index < keys.length; index++) {
          const key = keys[index];
          localStorage.removeItem(key);
        }

        return true;
      },

      seeding(seeding: Function): void {
        if (getStorageSync(`$seeded__${options.name}`)) return;
        seeding(model);
        setStorageSync(`$seeded__${options.name}`, "1");
      },

      clone(value: unknown): unknown {
        return clone(value, (data: any) => {
          throw new Error(
            `[Kurimudb] "${data.constructor.name}" cannot be stored in localStorage, only objects that can be serialized by JSON can be stored.`
          );
        });
      },

      all(): KMap<any> {
        if ("collection" !== options.modelType)
          throw new Error(
            `[Kurimudb] This function applies only to Collection Model.`
          );

        const index = getStorageSync(`$index__${options.name}`);
        if (!index) return makeKMap();
        const indexArr: Array<string> = JSON.parse(index);
        const rtnAllData = makeKMap();
        for (const item of indexArr) {
          rtnAllData[item] = this.select(item);
        }
        return rtnAllData;
      },

      getLength(): number {
        if ("collection" !== options.modelType)
          throw new Error(
            `[Kurimudb] This function applies only to Collection Model.`
          );

        const index = getStorageSync(`$index__${options.name}`);
        if (!index) return 0;
        const indexArr: Array<string> = JSON.parse(index);

        return indexArr.length;
      },

      getKeys(): Array<string> {
        if ("collection" !== options.modelType)
          throw new Error(
            `[Kurimudb] This function applies only to Collection Model.`
          );

        const index = getStorageSync(`$index__${options.name}`);
        if (!index) return [];
        const indexArr: Array<string> = JSON.parse(index);

        return indexArr;
      },
    };

    return product;
  }
}

export const taroDriverFactory = new TaroDriverFactory();
