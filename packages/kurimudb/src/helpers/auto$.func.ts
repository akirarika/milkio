import { SubscribeConfigInterface } from "../cache/subscribe-config.interface";
import { UnsubscribeInterface } from "../cache/subscribe.interface";
import { runtime } from "../providers";

export interface AutoSubscribeClosureFunctionInterface {
  (): void;
}

export function auto$(
  subClosFunc: AutoSubscribeClosureFunctionInterface,
  config: SubscribeConfigInterface = {}
): UnsubscribeInterface {
  config.immediate = false; // 所有用 auto$ 进行的订阅，均不主动触发首次订阅，由队列函数去主动触发

  runtime.readItemDependencies = [];
  subClosFunc();
  console.log(subClosFunc, runtime.readItemDependencies);

  const unsubscribeFuncArr = runtime.readItemDependencies.map((item) => {
    return item.subscribe(subClosFunc, config);
  });
  delete runtime.readItemDependencies;

  return () => {
    unsubscribeFuncArr.forEach((unsubscribe) => unsubscribe());
  };
}
