import { SubscribeConfigInterface } from "../cache/subscribe-config.interface";

export function batch$(
  subscibeFuncArr: any[],
  closFunc: Function,
  config: SubscribeConfigInterface = {}
) {
  const unsubscribeFuncArr = subscibeFuncArr.map((subscribeFunc) =>
    subscribeFunc(closFunc, config)
  );
  return () => {
    unsubscribeFuncArr.forEach((unsubscribe) => unsubscribe());
  };
}
