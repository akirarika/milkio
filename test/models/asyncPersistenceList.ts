import { Models } from "../../kurimudb";
import { DexieDriver } from "../../drivers/kurimudb-driver-dexie";
import db from "../migrations";
import Dexie from "dexie";

export interface AsyncPersistenceListItemInterface {
  // Model interface..
}

export const asyncPersistenceList = new (class AsyncPersistenceList extends Models.collection<
  AsyncPersistenceListItemInterface,
  DexieDriver
> {
  db: Dexie = db;

  constructor() {
    super({
      name: "asyncPersistenceList",
      type: "number",
      driver: DexieDriver,
    });

    this.seed(() => {
      // Data seeded by default for the model..
    });
  }
})();
