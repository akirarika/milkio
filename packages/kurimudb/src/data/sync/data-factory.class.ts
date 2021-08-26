import { AbstractDriver } from "../../abstract-driver.class";
import { SubscribeInterface } from "../../cache/subscribe.interface";
import { BaseModel } from "../../models/sync/base-model.class";

type DataKeys<Origin extends Record<string, any>> = {
  [Key in string & keyof Origin]: Key | `${Key}$`;
}[string & keyof Origin];

type DataProxyType<Origin extends Record<string, any>> = {
  [Key in DataKeys<Origin>]: Key extends `${string}$`
    ? SubscribeInterface
    : Origin[Key];
};

export class DataFactory {
  make<DataType, DriverType extends AbstractDriver>(
    model: BaseModel<DataType, DriverType>
  ) {
    return new Proxy({} as DataProxyType<DataType>, {
      set: (target, key, value, proxy) => {
        key = String(key);
        model.cache.put(key, value);
        // if (model.isPersistence())
        //   (async () =>
        //     await model.storage.insertOrUpdate(key, model.cache.get(key)))();
        // model.changed.set(key);
        return true;
      },
    });
  }
}
