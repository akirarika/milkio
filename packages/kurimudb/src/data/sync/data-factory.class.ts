import { SyncAbstractDriver } from "../../drivers/sync-abstract-driver.class";
import { SubscribeInterface } from "../../cache/subscribe.interface";
import { BaseModel } from "../../models/sync/base-model.class";

export type DataKeysType<Origin extends Record<string, any>> = {
  [Key in string & keyof Origin]: Key | `${Key}$`;
}[string & keyof Origin];

export type DataProxyType<Origin extends Record<string, any>> = {
  [Key in DataKeysType<Origin>]: Key extends `${string}$`
  ? SubscribeInterface
  : Origin[Key];
};

export class DataFactory {
  make<DataType, DriverType extends SyncAbstractDriver>(
    model: BaseModel<DataType, DriverType>
  ) {
    return new Proxy({} as DataProxyType<DataType>, {
      get: (target, key: any, receiver) => {
        key = `${key}`;
        if (key.endsWith("$")) {
          // subscribe
          key = key.substring(0, key.length - 1);
          return model.subscribeItem(key);
        } else {
          return model.getItem(key);
        }
      },
      set: (target, key: any, value: any) => {
        model.setItem(key, value);
        return true;
      },
      has: (target, key: any) => {
        return model.hasItem(key);
      },
      deleteProperty: (target, key: any) => {
        model.removeItem(key);
        return true;
      },
    });
  }
}
