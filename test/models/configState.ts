import { DexieDriver } from "../../drivers/kurimudb-driver-dexie";
import { LocalStorageDriver } from "../../drivers/kurimudb-driver-localstorage";
import { Models } from "../../kurimudb";
import migrations from "../migrations";

export default new (class ConfigState extends Models.collection<any> {
  constructor() {
    super({
      // driver: LocalStorageDriver,
      driver: DexieDriver,
      db: migrations,
    });

    this.seed([]);
  }
})();
