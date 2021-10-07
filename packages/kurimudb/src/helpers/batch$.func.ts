import { SubscribeConfigInterface } from "../cache/subscribe-config.interface";
import {
  SubscribeClosureInterface,
  SubscribeInterface,
  UnsubscribeInterface,
} from "../cache/subscribe.interface";

export function batch$(
  subscibeFuncArr: SubscribeInterface[],
  subClosFunc: SubscribeClosureInterface,
  config: SubscribeConfigInterface = {}
) {
  const unsubscribeFuncArr = subscibeFuncArr.map((subscribeFunc) =>
    subscribeFunc(subClosFunc, config)
  );
  return () => {
    unsubscribeFuncArr.forEach((unsubscribe) => unsubscribe());
  };
}
