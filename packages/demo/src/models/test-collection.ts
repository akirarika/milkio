import { AsyncModels } from "kurimudb";
import { DexieDriver, dexieDriverFactory } from "kurimudb-driver-dexie";
import { db } from "./db";

class TestCollection extends AsyncModels.collection<
  {
    count: number;
    test: any;
  },
  DexieDriver
> {
  constructor() {
    super({
      name: "TestCollection",
      driver: dexieDriverFactory,
      db: db,
      // autoIncrementHandler: () => `${Math.floor(Math.random() * 1000)}`,
    });

    this.seed([
      {
        count: 123,
        test: "123",
      },
      {
        count: 123,
        test: "456",
      },
      {
        count: 123,
        test: "789",
      },
      {
        count: 123,
        test: "111",
      },
    ]);
  }
}

export const testCollection = new TestCollection();
