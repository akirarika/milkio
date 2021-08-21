import { BaseModel } from "./base-model.class";
import { ModelOptions } from "./model-options.interface";

export class CollectionModel<
  DataItemInterface = Record<string | number, any>,
  driver = any
> extends BaseModel<DataItemInterface[], driver> {
  private __INCREMENT = 0; // 模型自增的主键，仅在未持久化时使用

  constructor(options: ModelOptions = {}) {
    super(
      (() => {
        options.modelType = "collection";
        if (!("type" in options)) options.type = "number";
        return options;
      })()
    );
  }

  /**
   * Insert item
   * Insert a new piece of data into the collection model,
   * the primary key of this data will be automatically incremented.
   *
   * @param value
   * @returns 新数据的id
   */
  insert(value: DataItemInterface): number | Promise<number> {
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
      const key = ++this["__INCREMENT"];
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
