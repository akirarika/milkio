import { AbstractDriver } from "../abstract-driver.class";
import { BaseModel } from "./base-model.class";
import { ModelOptionsInterface } from "./model-options.interface";

export class CollectionModel<
  Data extends Record<string | number, any> = Record<string | number, any>,
  Driver extends AbstractDriver = AbstractDriver
> extends BaseModel<Data[], Driver> {
  // TODO: use a memory driver by default
  /**
   * The primary key used when the driver is not specified.
   */
  private nextPrimaryKey = 1;

  constructor(options: ModelOptionsInterface = {}) {
    super({
      ...options,
      modelType: "collection",
      type: options.type ?? "number",
    });
  }

  /**
   * Insert item
   * Insert a new piece of data into the collection model,
   * the primary key of this data will be automatically incremented.
   *
   * @param value
   * @returns - The primary key of the new data.
   */
  insert(value: Data): number | Promise<number> {
    if (this?.storage) {
      if (this.options.async)
        return (async () => {
          const storage = this.storage as any;
          const key = await storage.insert(value);
          this.cache.add(key, value);
          this.changed.set(key);
          return key;
        })();
      else {
        const storage = this.storage as any;
        const key = storage.insert(value);
        this.cache.add(key, value);
        this.changed.set(key);
        return key;
      }
    } else {
      const key = this.nextPrimaryKey++;
      this.cache.add(key, value);
      this.changed.set(key);
      return key;
    }
  }

  /**
   * Seed data
   * @returns
   */
  seed(seed: any) {
    let seedFunc;
    if ("function" === typeof seed) seedFunc = seed;
    else if (seed instanceof Array) {
      seedFunc = () => {
        for (const item of seed) this.insert(item);
      };
    } else {
      throw new Error(
        `In "collection" model, the argument to the seed function must be "Function" or "Array".`
      );
    }

    if (!this.isPersistence()) return seedFunc();
    const storage = this.storage as any;
    storage.seeding(seedFunc, this);
  }
}
