import { SyncAbstractDriver } from "../../drivers/sync-abstract-driver.class";
import { BaseModel } from "./base-model.class";
import { ModelOptionsInterface } from "../model-options.interface";

export class CollectionModel<
  DataType = any,
  DriverType extends SyncAbstractDriver = SyncAbstractDriver
> extends BaseModel<Record<string, DataType>, DriverType> {
  constructor(options: ModelOptionsInterface) {
    super({
      ...options,
      ioType: "sync",
      modelType: "collection",
    });
  }

  seeded = false;
  private nextPrimaryKey = 1;

  insertItem(value: DataType): string {
    if (undefined === this.storage) {
      const skey = String(this.nextPrimaryKey++);
      this.cache.put(skey, value);

      return skey;
    } else {
      const skey = this.storage.insertAutoIncrement(value);
      this.cache.put(skey, value);

      return skey;
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
