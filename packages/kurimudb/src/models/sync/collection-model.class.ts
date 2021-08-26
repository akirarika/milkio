import { AbstractDriver } from "../../abstract-driver.class";
import { BaseModel } from "./base-model.class";
import { ModelOptionsInterface } from "../model-options.interface";

export class CollectionModel<
  Data extends Record<string, any> = Record<string, any>,
  Driver extends AbstractDriver = AbstractDriver
> extends BaseModel<Data[], Driver> {
  constructor(options: ModelOptionsInterface) {
    super({
      ...options,
      ioType: "sync",
      modelType: "collection",
    });
  }
}
