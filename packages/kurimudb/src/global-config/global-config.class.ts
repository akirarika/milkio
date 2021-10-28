import * as async from "../models/async/model-options.interface";
import * as sync from "../models/sync/model-options.interface";

export class GlobalConfig {
  autoUnsubscribe: false | Function = false;
  syncAutoIncrementHandler?: (options: sync.ModelOptionsInterface) => string = undefined;
  asyncAutoIncrementHandler?: (options: async.ModelOptionsInterface) => Promise<string> = undefined;

  setAutoUnsubscribe(val: false | Function) {
    this.autoUnsubscribe = val;
  }

  setSyncAutoIncrementHandler(handler: (options: sync.ModelOptionsInterface) => string) {
    this.syncAutoIncrementHandler = handler;
  }

  setAsyncAutoIncrementHandler(handler: (options: async.ModelOptionsInterface) => Promise<string>) {
    this.asyncAutoIncrementHandler = handler;
  }
}
