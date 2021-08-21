import { BaseModel } from "./base-model.class";
import { ModelOptions } from "./model-options.interface";

export class KeyValueModel<
  DataInterface = Record<string | number, any>,
  driver = any
> extends BaseModel<DataInterface, driver> {
  constructor(options: ModelOptions = {}) {
    super(
      (() => {
        options.modelType = "keyValue";
        if (!("type" in options)) options.type = "string";
        return options;
      })()
    );
  }

  /**
   * Seed data
   * @returns
   */
  seed(seed: any) {
    let seedFunc;
    if ("function" === typeof seed) seedFunc = seed;
    else if ("object" === typeof seed && !(seed instanceof Array)) {
      seedFunc = () => {
        for (const key in seed) (this.data as any)[key] = seed[key];
      };
    } else {
      throw new Error(
        `In "keyValue" model, the argument to the seed function must be "Function" or "Object".`
      );
    }

    if (!this.isPersistence()) return seedFunc();
    const storage = this.storage as any;
    storage.seeding(seedFunc, this);
  }
}
