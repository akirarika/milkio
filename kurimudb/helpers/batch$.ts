import { subscribeConfigInterface } from '../cache/item';

export default function batch$(subscibeFuncArr: any[], closFunc: Function, config: subscribeConfigInterface = {}) {
  return subscibeFuncArr.map((subscribeFunc) => subscribeFunc(closFunc, config));
}
