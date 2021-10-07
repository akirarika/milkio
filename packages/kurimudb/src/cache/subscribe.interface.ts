import { SubscribeConfigInterface } from "./subscribe-config.interface";

export interface UnsubscribeInterface {
  (): void;
}

export interface SubscribeClosureInterface {
  (value: any, key: string): void;
}

export interface SubscribeInterface {
  (
    closFunc: SubscribeClosureInterface,
    config?: SubscribeConfigInterface
  ): UnsubscribeInterface;
}
