import { AbstractDriver } from "../../abstract-driver.class";
import { ModelOptionsInterface } from "../model-options.interface";
import { cacheFactory, syncDataFactory } from "../../providers";

export class BaseModel<DataType, DriverType extends AbstractDriver> {
  public options;
  public data;
  public cache;

  constructor(options: ModelOptionsInterface) {
    this.options = this.checkOptions(options);

    this.cache = cacheFactory.make<DataType, DriverType>(this);
    this.data = syncDataFactory.make<DataType, DriverType>(this);
  }

  private checkOptions(options: ModelOptionsInterface): ModelOptionsInterface {
    if (!options.name) throw new Error(`The model name does not exist.`);

    options.primary = options.primary ?? "_id";
    options.async = options.async ?? false;

    return options;
  }
}