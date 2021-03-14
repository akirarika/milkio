import { CookieDriver, Model, RxjsDriver } from "../../../../dist";
import { BehaviorSubject } from "rxjs";

export default new Model({
  config: {
    name: "config_state",
    type: "string",
    drivers: {
      cache: RxjsDriver,
      cacheInject: BehaviorSubject,
      persistence: CookieDriver,
    },
  },
});
