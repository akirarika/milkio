import { SubscribeConfigInterface } from "./subscribe-config.interface";

export interface SubscribeInterface<T> {
  (closFunc: any, config?: SubscribeConfigInterface): Function;
}
