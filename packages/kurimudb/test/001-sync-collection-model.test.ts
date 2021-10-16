import { SyncModels } from "../src";
import {
  TestSyncDriver,
  testSyncDriverFactory,
} from "./test-sync-driver.class";

class SyncList extends SyncModels.collection<any, TestSyncDriver> {
  constructor() {
    super({
      name: "SyncCollectionModel",
      driver: testSyncDriverFactory,
    });
  }
}

const syncList = new SyncList();

test("seeding", () => {
  syncList.seed(["foo"]);
  syncList.seed(["bar"]);
  expect(syncList.data[1]).toBe("foo");
});

test("bread", () => {
  expect(syncList.data[0]).toBe(undefined);

  expect(syncList.data[2]).toBe(undefined);
  syncList.insertItem("hello");
  syncList.insertItem("world");
  expect(syncList.data[2]).toBe("hello");
  expect(syncList.data[3]).toBe("world");
});

test("bread (bulk)", () => {
  syncList.bulkInsertItem(["hello", "world"]);
  expect(syncList.data[4]).toBe("hello");
  expect(syncList.data[5]).toBe("world");
});