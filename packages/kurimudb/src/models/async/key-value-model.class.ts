import { SyncAbstractDriverInterface, AsyncAbstractDriverInterface } from "../..";
import { BaseModel } from "./base-model.class";
import { ModelOptionsInterface } from "./model-options.interface";

export class KeyValueModel<
  DataType extends Record<string, any> = Record<string, any>,
  DriverType extends SyncAbstractDriverInterface | AsyncAbstractDriverInterface = AsyncAbstractDriverInterface
  > extends BaseModel<DataType, DriverType> {
  constructor(options: Partial<ModelOptionsInterface>) {
    super({
      ...options,
      ioType: "async",
      modelType: "keyValue",
    });
  }

  seeded = false;

  async seed(seed: Function | Partial<DataType>): Promise<void> {
    let seedFunc;
    if ("function" === typeof seed) {
      seedFunc = async () => {
        this.seeded = true;
        await seed();
      };
    } else if ("object" === typeof seed && !(seed instanceof Array)) {
      seedFunc = async () => {
        this.seeded = true;
        for (const key in seed) await this.setItem(key, seed[key] as any);
      };
    } else {
      throw new Error(
        `[Kurimudb] In "keyValue" model, the argument to the seed function must be "Function" or "Object".`
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
