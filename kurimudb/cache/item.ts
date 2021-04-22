import { kurimudbConfig } from "..";

export interface subscribeConfigInterface {
  immediate?: boolean;
  autoUnsubscribe?: boolean;
}

export interface subscribeInterface<T> {
  (closFunc: any, config?: subscribeConfigInterface): Function;
}

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

  subscribe: subscribeInterface<T> = (
    closFunc: any,
    config: subscribeConfigInterface = {}
  ): Function => {
    const conf: subscribeConfigInterface = {
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
      if (false !== kurimudbConfig.autoUnsubscribe)
        kurimudbConfig.autoUnsubscribe(unsubscribe);
    }
    return unsubscribe;
  };
}
