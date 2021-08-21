import { globalConfig } from "../global-config";
import { runtime } from "../runtime";
import { SubscribeConfigInterface } from "./subscribe-config.interface";
import { SubscribeInterface } from "./subscribe.interface";

let counter = 0;

export class Item<T = any> {
  value: T;
  key: string | number;
  subscribers: Map<number, any>;

  constructor(value: T, key: string | number) {
    this.value = value;
    this.key = key;
    this.subscribers = new Map();
  }

  set(value: T): void {
    this.value = value;
    this.publish();
  }

  get(): T {
    if (runtime.collectingReadItemDependencies) {
      runtime.readItemDependencies.push(this);
    }
    return this.value;
  }

  forget(): void {
    this.value = void 0 as any;
  }

  publish() {
    const value = this.value;
    const key = this.key;
    const arr: any[] = [];

    if (void 0 === value) return;

    this.subscribers.forEach((job) => arr.push(job(value, key)));

    return Promise.all(arr);
  }

  subscribe: SubscribeInterface<T> = (
    closFunc: any,
    config: SubscribeConfigInterface = {}
  ): Function => {
    const conf: SubscribeConfigInterface = {
      immediate: true,
      autoUnsubscribe: true,
      ...config,
    };
    // 追加订阅队列
    this.subscribers.set(++counter, closFunc);
    const id = counter;
    if (conf.immediate) this.publish();
    // 生成此订阅的退订函数
    const unsubscribe = () => this.subscribers.delete(id);
    if (conf.autoUnsubscribe) {
      if (false !== globalConfig.autoUnsubscribe)
        globalConfig.autoUnsubscribe(unsubscribe);
    }
    return unsubscribe;
  };
}
