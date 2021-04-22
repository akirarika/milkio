import { Models } from "kurimudb";
import { LocalStorageDriver } from "kurimudb-driver-localstorage";

export default new (class Local extends Models.keyValue<
  Record<string, any>,
  null
> {
  constructor() {
    super({
      name: "local",
      type: "string",
      driver: LocalStorageDriver,
    });
  }
})();
