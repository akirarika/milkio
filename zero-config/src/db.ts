import { Models } from "kurimudb";
import { DexieDriver } from "kurimudb-driver-dexie";
import db from "./_migrations";
import Dexie from "dexie";

export default new (class Db extends Models.keyValue<
  Record<string, any>,
  DexieDriver
> {
  db: Dexie = db;

  constructor() {
    super({
      name: "db",
      type: "string",
      driver: DexieDriver,
    });
  }
})();
