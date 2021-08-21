import { Models } from "kurimudb";
import { DexieDriver } from "kurimudb-driver-dexie";
import db from "./_migrations";

export class Db extends Models.keyValue<Record<string, any>, DexieDriver> {
  constructor() {
    super({
      name: "db",
      type: "string",
      db: db,
      driver: DexieDriver,
    });
  }
}
