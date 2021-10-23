import { ModelOptionsInterface as SyncModelOptionsInterface } from "../models/sync/model-options.interface";
import { ModelOptionsInterface as AsyncModelOptionsInterface } from "../models/async/model-options.interface";

export class GlobalConfig {
  autoUnsubscribe: false | Function = false;
  syncAutoIncrementHandler?: (options: SyncModelOptionsInterface) => string = undefined;
  asyncAutoIncrementHandler?: (options: AsyncModelOptionsInterface) => Promise<string> = undefined;

  setAutoUnsubscribe(val: false | Function) {
    this.autoUnsubscribe = val;
  }

  setSyncAutoIncrementHander(hander: (options: SyncModelOptionsInterface) => string) {
    this.syncAutoIncrementHandler = hander;
  }

  setAsyncAutoIncrementHander(hander: (options: AsyncModelOptionsInterface) => Promise<string>) {
    this.asyncAutoIncrementHandler = hander;
  }
}
