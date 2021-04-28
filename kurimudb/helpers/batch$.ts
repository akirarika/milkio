import { subscribeConfigInterface } from "../cache/item";

export default function batch$(
  subscibeFuncArr: any[],
  closFunc: Function,
  config: subscribeConfigInterface = {}
) {
  const unsubscribeFuncArr = subscibeFuncArr.map((subscribeFunc) =>
    subscribeFunc(closFunc, config)
  );
  return () => {
    unsubscribeFuncArr.forEach((unsubscribe) => unsubscribe());
  };
}
