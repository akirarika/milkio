import { AsyncAbstractDriverInterface, SyncAbstractDriverInterface } from "../..";
import { SubscribeInterface } from "../../cache/subscribe.interface";
import { BaseModel } from "../../models/async/base-model.class";

export type DataKeysType<Origin extends Record<string, any>> = {
  [Key in string & keyof Origin]: Key | `${Key}$`;
}[string & keyof Origin];

export type DataProxyType<Origin extends Record<string, any>> = {
  [Key in DataKeysType<Origin>]: Key extends `${string}$`
  ? SubscribeInterface
  : Promise<Origin[Key]> | Origin[Key];
};

export class DataFactory {
  make<DataType, DriverType extends SyncAbstractDriverInterface | AsyncAbstractDriverInterface | undefined>(
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
        throw new Error(`[Kurimudb] Like "${model.options.name}.data.${key} = ${JSON.stringify(value)}" cannot be used on the Async Model because of JavaScript limitations. Please use "await ${model.options.name}.setItem('${key}')"`);
        return false;
      },
      has: (target, key: any) => {
        throw new Error(`[Kurimudb] Like "'${key}' in ${model.options.name}.data" cannot be used on the Async Model because of JavaScript limitations. Please use "await ${model.options.name}.has('${key}')"`);
        return false;
      },
      deleteProperty: (target, key: any) => {
        throw new Error(`[Kurimudb] Like "delete ${model.options.name}.data.${key}" cannot be used on the Async Model because of JavaScript limitations. Please use "await ${model.options.name}.removeItem('${key}')"`);
        return false;
      },
    });
  }
}
