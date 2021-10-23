import { SyncAbstractDriverInterface } from "../../drivers/sync-abstract-driver.class";
import { BaseModel } from "./base-model.class";
import { ModelOptionsInterface } from "./model-options.interface";

export class KeyValueModel<
  DataType extends Record<string, any> = Record<string, any>,
  DriverType extends SyncAbstractDriverInterface | undefined = undefined
  > extends BaseModel<DataType, DriverType> {
  constructor(options: Partial<ModelOptionsInterface>) {
    super({
      ...options,
      ioType: "sync",
      modelType: "keyValue",
    });
  }

  seeded = false;

  seed(seed: Function | Partial<DataType>) {
    let seedFunc;
    if ("function" === typeof seed) {
      seedFunc = () => {
        this.seeded = true;
        seed();
      };
    } else if ("object" === typeof seed && !(seed instanceof Array)) {
      seedFunc = () => {
        this.seeded = true;
        for (const key in seed) this.setItem(key, seed[key] as any);
      };
    } else {
      throw new Error(
        `[Kurimudb] In "keyValue" model, the argument to the seed function must be "Function" or "Object".`
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
