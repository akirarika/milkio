export class GlobalConfig {
  autoUnsubscribe: false | Function = false;

  setAutoUnsubscribe(val: false | Function) {
    this.autoUnsubscribe = val;
  }
}
