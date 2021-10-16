import { SyncAbstractDriverInterface, AsyncAbstractDriverInterface } from "../..";
import { BaseModel } from "./base-model.class";
import { ModelOptionsInterface } from "./model-options.interface";

export class CollectionModel<
  DataType = any,
  DriverType extends SyncAbstractDriverInterface | AsyncAbstractDriverInterface = AsyncAbstractDriverInterface
  > extends BaseModel<Record<string, DataType>, DriverType> {
  constructor(options: Partial<ModelOptionsInterface>) {
    super({
      ...options,
      ioType: "async",
      modelType: "collection",
    });
  }

  private nextPrimaryKey = 1;
  public seeded = false;

  insertItem(item: DataType): string {
    if (undefined === this.storage) {
      const skey = String(this.nextPrimaryKey++);
      this.cache.put(skey, item);

      return skey;
    } else {
      const skey = this.storage.insertAutoIncrement(item);
      return skey;
    }
  }

  bulkInsertItem(items: Array<DataType>): Array<string> {
    if (undefined === this.storage) {
      const keys: Array<string> = [];
      for (const key in items) {
        const skey = String(this.nextPrimaryKey++);
        this.cache.put(skey, items[key]);
        keys.push(skey);
      }

      return keys;
    } else {
      const keys = this.storage.bulkInsertAutoIncrement(items.map((v) => String(v)));

      return keys;
    }
  }

  seed(seed: Function | Partial<Array<DataType>>) {
    let seedFunc;

    if ("function" === typeof seed) {
      seedFunc = () => {
        this.seeded = true;
        seed();
      };
    } else if (seed instanceof Array) {
      seedFunc = () => {
        this.seeded = true;
        for (const item of seed) {
          if (item) this.insertItem(item);
        }
      };
    } else {
      throw new Error(
        `In "keyValue" model, the argument to the seed function must be "Function" or "Array".`
      );
    }

    if (this.seeded) return;

    if (undefined === this.storage) {
      seedFunc();
      return;
    }
    const storage = this.storage;
    storage.seeding(seedFunc);
  }
}
