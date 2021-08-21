import { SubscribeConfig } from "./subscribe-config.interface";

export interface Subscribe<T> {
  (closFunc: any, config?: SubscribeConfig): Function;
}
