import { Models } from "../../kurimudb";
import { DexieDriver } from "../../drivers/kurimudb-driver-dexie";
import db from "../migrations";
import Dexie from "dexie";

export interface AsyncPersistenceStateInterface {
  // Model interface..
}

export const asyncPersistenceState = new (class AsyncPersistenceState extends Models.keyValue<
  AsyncPersistenceStateInterface,
  DexieDriver
> {
  db: Dexie = db;

  constructor() {
    super({
      name: "asyncPersistenceState",
      type: "string",
      driver: DexieDriver,
    });

    this.seed(() => {
      // Data seeded by default for the model..
    });
  }
})();
