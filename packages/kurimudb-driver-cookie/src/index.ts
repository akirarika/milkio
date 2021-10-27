import {
  makeKMap,
  SyncAbstractDriverFactory,
  SyncAbstractDriverInterface,
  KMap,
  SyncBaseModel,
  clone,
} from 'kurimudb';
import { CookieAttributes } from './cookie-attributes.interface';
import Cookies from 'js-cookie';

export interface CookieDriver extends SyncAbstractDriverInterface {
  set(key: string, value: unknown, attributes?: CookieAttributes): void;
  get(
    key: string,
  ): Array<any> | Record<string | number, any> | string | undefined;
  remove(key: string, options?: CookieAttributes): void;
}

const defaultExpires = 1157;

class CookieDriverFactory extends SyncAbstractDriverFactory {
  make<DataType, DriverType extends SyncAbstractDriverInterface | undefined>(
    model: SyncBaseModel<DataType, DriverType>,
  ) {
    const options = model.options;
    if ('collection' === options.modelType) {
      throw new Error(
        `[Kurimudb] The CookieDriver is not applicable to the CollectionModel. Try to replace another driver, such as LocalStorageDriver`,
      );
    }

    const product: CookieDriver = {
      set(key: string, value: unknown, options?: CookieAttributes): void {
        value = 'object' === typeof value ? JSON.stringify(value) : value;
        if (undefined === options) options = {};

        Cookies.set(key, `${value}`, options);
      },

      get(
        key: string,
      ): Array<any> | Record<string | number, any> | string | undefined {
        let value = Cookies.get(key);
        if (undefined === value) return undefined;
        try {
          if (value.startsWith('{')) return JSON.parse(value);
          if (value.startsWith('[')) return JSON.parse(value);
        } catch (error) {
          return value;
        }
        return value;
      },

      remove(key: string, options?: CookieAttributes): void {
        Cookies.remove(key, options);
      },

      insert(key: string, value: unknown): boolean {
        if (undefined === product.get(key)) return false;
        product.set(key, value, { expires: defaultExpires });
        return true;
      },

      update(key: string, value: unknown): boolean {
        if (undefined !== product.get(key)) return false;
        product.set(key, value, { expires: defaultExpires });
        return true;
      },

      insertOrUpdate(key: string, value: unknown): void {
        product.set(key, value, { expires: defaultExpires });
      },

      insertAutoIncrement(value: unknown): string {
        throw new Error(
          `[Kurimudb] The CookieDriver is not applicable to the CollectionModel. Try to replace another driver, such as LocalStorageDriver`,
        );
      },

      select(key: string): unknown | undefined {
        return product.get(key);
      },

      exists(key: string): boolean {
        return undefined !== product.get(key);
      },

      delete(key: string): boolean {
        product.remove(key);
        return true;
      },

      bulkInsert(items: Record<string, unknown>): boolean {
        for (const key in items) {
          if (null !== product.exists(key)) return false;
        }
        for (const key in items) {
          product.set(key, items[key], { expires: defaultExpires });
        }
        return true;
      },

      bulkInsertAutoIncrement(items: Array<unknown>): Array<string> {
        throw new Error(
          `[Kurimudb] The CookieDriver is not applicable to the CollectionModel. Try to replace another driver, such as LocalStorageDriver`,
        );
      },

      bulkUpdate(items: Record<string, unknown>): boolean {
        for (const key in items) {
          if (null === product.exists(key)) return false;
        }
        for (const key in items) {
          product.set(key, items[key], { expires: defaultExpires });
        }
        return true;
      },

      bulkInsertOrUpdate(items: Record<string, unknown>): boolean {
        for (const key in items) {
          product.set(key, items[key], { expires: defaultExpires });
        }
        return true;
      },

      bulkSelect(keys: Array<string>): KMap<unknown> {
        const data = makeKMap();
        for (let index = 0; index < keys.length; index++) {
          const key = keys[index];
          data[key] = product.get(key);
        }

        return data;
      },

      bulkDelete(keys: Array<string>): boolean {
        for (let index = 0; index < keys.length; index++) {
          const key = keys[index];
          product.remove(key);
        }

        return true;
      },

      seeding(seeding: Function): void {
        throw new Error(
          `[Kurimudb] The CookieDriver is not applicable to the seed function. Try to replace another driver, such as LocalStorageDriver`,
        );
      },

      clone(value: unknown): unknown {
        return clone(value, (data: any) => {
          throw new Error(
            `${data.constructor.name} cannot be stored in localStorage, only objects that can be serialized by JSON can be stored.`,
          );
        });
      },
    };

    return product;
  }
}

export const cookieDriverFactory = new CookieDriverFactory();
