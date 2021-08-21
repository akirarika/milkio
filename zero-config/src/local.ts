import { Models } from "kurimudb";
import { LocalStorageDriver } from "kurimudb-driver-localstorage";

export class Local extends Models.keyValue<
  Record<string, any>,
  LocalStorageDriver
> {
  constructor() {
    super({
      name: "local",
      type: "string",
      driver: LocalStorageDriver,
    });
  }
}
