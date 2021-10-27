import { AsyncModels } from "kurimudb";
import {
  LocalStorageDriver,
  localStorageDriverFactory,
} from "kurimudb-driver-localstorage";
import { db } from "./db";

class TestState extends AsyncModels.keyValue<
  {
    count: any;
    test: any;
  },
  LocalStorageDriver
> {
  constructor() {
    super({
      name: "TestState",
      driver: localStorageDriverFactory,
      db: db,
    });

    this.seed({
      count: 0,
    });
  }
}

export const testState = new TestState();
