import {
  SyncAbstractDriverInterface,
  AsyncAbstractDriverInterface,
} from "../..";
import { globalConfig } from "../../providers";
import { BaseModel } from "./base-model.class";
import { ModelOptionsInterface } from "./model-options.interface";

export class CollectionModel<
  DataType = any,
  DriverType extends
    | SyncAbstractDriverInterface
    | AsyncAbstractDriverInterface = AsyncAbstractDriverInterface
> extends BaseModel<Record<string, DataType>, DriverType> {
  constructor(options: Partial<ModelOptionsInterface>) {
    super({
      autoIncrementHandler: globalConfig.asyncAutoIncrementHandler,
      ...options,
      ioType: "async",
      modelType: "collection",
    });
  }

  private nextPrimaryKey = 1;
  public seeded = false;

  async insertItem(item: DataType): Promise<string> {
    if (undefined === this.storage) {
      let skey: string;
      if (undefined === this.options.autoIncrementHandler)
        skey = String(this.nextPrimaryKey++);
      else skey = await this.options.autoIncrementHandler(this.options);
      this.cache.put(skey, item);

      return skey;
    } else {
      const skey = await this.storage.insertAutoIncrement(item);
      return skey;
    }
  }

  async bulkInsertItem(items: Array<DataType>): Promise<Array<string>> {
    if (undefined === this.storage) {
      const keys: Array<string> = [];
      for (const key in items) {
        const skey = String(this.nextPrimaryKey++);
        this.cache.put(skey, items[key]);
        keys.push(skey);
      }

      return keys;
    } else {
      const keys = await this.storage.bulkInsertAutoIncrement(items);

      return keys;
    }
  }

  async seed(seed: Function | Array<DataType>): Promise<void> {
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
      await seedFunc();
      return;
    }
    const storage = this.storage;
    await storage.seeding(seedFunc);
  }
}
