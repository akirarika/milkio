import { SyncModels } from "kurimudb";

class SyncState extends SyncModels.keyValue {
  constructor() {
    super({
      name: "SyncKeyValueModel",
    });
  }
}

const syncState = new SyncState();

test("adds 1 + 2 to equal 3", () => {
  syncState.data.hello = "world";

  expect(syncState.data.hello).toBe("world");
});
