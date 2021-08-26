import { SubscribeConfigInterface } from "./subscribe-config.interface";

export interface SubscribeInterface {
  (closFunc: Function, config?: SubscribeConfigInterface): Function;
}
