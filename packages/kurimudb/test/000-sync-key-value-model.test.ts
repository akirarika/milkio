import { auto$, batch$, SyncModels } from "../src";
import {
  TestSyncDriver,
  TestSyncDriverInterface,
} from "./test-sync-driver.class";

class SyncState extends SyncModels.keyValue<
  {
    hello1?: string;
    hello2: string;
    hello3: string;
    hello4: string;
    hello5: string;
    hello6: string;
    hello7: string;
    hello8: string;
  },
  TestSyncDriverInterface
> {
  constructor() {
    super({
      name: "SyncKeyValueModel",
      driver: TestSyncDriver,
    });
  }
}

const syncState = new SyncState();

test("bread", () => {
  expect(syncState.data.hello1).toBe(undefined);

  syncState.data.hello1 = "world";
  expect(syncState.data.hello1).toBe("world");

  syncState.data.hello1 = "hello";
  expect(syncState.data.hello1).toBe("hello");

  delete syncState.data.hello1;
  expect(syncState.data.hello1).toBe(undefined);
});

test("seeding", () => {
  syncState.seed({
    hello2: "world",
  });
  syncState.seed({
    hello2: "hello",
  });
  expect(syncState.data.hello2).toBe("world");
});

test("subscribe (base)", () => {
  let i = 0;

  // assign first
  syncState.data.hello3 = "world";
  syncState.data.hello3$((val: string) => {
    i++;
    if (1 === i) expect(val).toBe("world");
    if (2 === i) expect(val).toBe("hello");
  });
  syncState.data.hello3 = "hello";

  // assign last
  syncState.data.hello4$((val: string) => {
    expect(val).toBe("world");
  });
  syncState.data.hello4 = "world";
});

test("subscribe (model)", () => {
  let i = 0;

  syncState.$((val: string) => {
    i++;
    if (1 === i) expect(val).toBe("hello4");
    if (2 === i) expect(val).toBe("hello5");
  });

  syncState.data.hello5 = "world";
});

test("subscribe (batch)", () => {
  let i = 0;
  batch$([syncState.data.hello6$, syncState.data.hello7$], (val, key) => {
    i++;
    if (1 === i) {
      expect(key).toBe("hello6");
      expect(val).toBe("world6");
    }
    if (2 === i && "hello7" === key) {
      expect(key).toBe("hello7");
      expect(val).toBe("world7");
    }
  });
  syncState.data.hello6 = "world6";
  syncState.data.hello7 = "world7";
});

test("subscribe (auto)", () => {
  let i = 0;

  auto$(() => {
    i++;
    if (1 === i) expect(syncState.data.hello8).toBe(undefined);
    if (2 === i) expect(syncState.data.hello8).toBe("hello");
    if (3 === i) expect(syncState.data.hello8).toBe("hello8");
  });

  syncState.data.hello8 = "hello";
  syncState.data.hello8 = "hello8";
});
