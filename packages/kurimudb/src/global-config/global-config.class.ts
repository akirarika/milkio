import * as async from "../models/async/model-options.interface";
import * as sync from "../models/sync/model-options.interface";

export class GlobalConfig {
  autoUnsubscribe: false | Function = false;
  syncAutoIncrementHandler?: (options: sync.ModelOptionsInterface) => string = undefined;
  asyncAutoIncrementHandler?: (options: async.ModelOptionsInterface) => Promise<string> = undefined;

  setAutoUnsubscribe(val: this['autoUnsubscribe']) {
    this.autoUnsubscribe = val;
  }

  setSyncAutoIncrementHandler(handler: NonNullable<this['syncAutoIncrementHandler']>) {
    this.syncAutoIncrementHandler = handler;
  }

  setAsyncAutoIncrementHandler(handler: NonNullable<this['asyncAutoIncrementHandler']>) {
    this.asyncAutoIncrementHandler = handler;
  }
}
