import { SyncAbstractDriverInterface } from "../../drivers/sync-abstract-driver.class";
import { globalConfig } from "../../providers";
import { BaseModel } from "./base-model.class";
import { ModelOptionsInterface } from "./model-options.interface";

export class CollectionModel<
  DataType = any,
  DriverType extends SyncAbstractDriverInterface | undefined = undefined
> extends BaseModel<Record<string, DataType>, DriverType> {
  constructor(options: Partial<ModelOptionsInterface>) {
    super({
      autoIncrementHandler: globalConfig.syncAutoIncrementHandler,
      ...options,
      ioType: "sync",
      modelType: "collection",
    });
  }

  private nextPrimaryKey = 1;
  public seeded = false;

  insertItem(item: DataType): string {
    if (undefined === this.storage) {
      let skey: string;
      if (undefined === this.options.autoIncrementHandler)
        skey = String(this.nextPrimaryKey++);
      else skey = this.options.autoIncrementHandler(this.options);
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
      const keys = this.storage.bulkInsertAutoIncrement(items);

      return keys;
    }
  }

  seed(seed: Function | Array<DataType>) {
    let seedFunc;

    if ("function" === typeof seed) {
      seedFunc = () => {
        this.seeded = true;
        seed();
      };
    } else if (seed instanceof Array) {
      seedFunc = () => {
        this.seeded = true;
        this.bulkInsertItem(seed);
      };
    } else {
      throw new Error(
        `[Kurimudb] In "keyValue" model, the argument to the seed function must be "Function" or "Array".`
      );
    }

    if (this.seeded) return;

    if (undefined === this.storage) {
      seedFunc();
    } else {
      this.storage.seeding(seedFunc);
    }
  }
}
