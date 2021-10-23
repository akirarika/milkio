import { batch$, AsyncModels } from "../src";
import {
  TestAsyncDriver,
  testAsyncDriverFactory,
} from "./test-async-driver.class";

class AsyncState extends AsyncModels.keyValue<
  {
    hello1?: string;
    hello2: string;
    hello3: string;
    hello4: string;
    hello5: string;
    hello6: string;
    hello7: string;
    hello8: string;
    hello9: string;
    "9": string;
  },
  TestAsyncDriver
> {
  constructor() {
    super({
      name: "SyncKeyValueModel",
      driver: testAsyncDriverFactory,
    });
  }
}

const asyncState = new AsyncState();

test("bread", async () => {
  expect(await asyncState.data.hello1).toBe(undefined);
  await asyncState.setItem("hello1", "world");
  expect(await asyncState.data.hello1).toBe("world");
  await asyncState.setItem("hello1", "hello");
  expect(await asyncState.data.hello1).toBe("hello");
  await asyncState.removeItem("hello1");
  expect("then" in (asyncState.data.hello1 as any)).toBe(true);
  expect(await asyncState.data.hello1).toBe(undefined);
});

test("seeding", async () => {
  await asyncState.seed({
    hello2: "world",
  });
  await asyncState.seed({
    hello2: "hello",
  });
  expect(await asyncState.data.hello2).toBe("world");
});

test("subscribe (base)", async () => {
  let i = 0;

  // assign first
  await asyncState.setItem("hello3", "world");
  asyncState.data.hello3$((val: string) => {
    i++;
    if (1 === i) expect(val).toBe("world");
    if (2 === i) expect(val).toBe("hello");
  });
  await asyncState.setItem("hello1", "hello");

  // assign last
  asyncState.data.hello4$((val: string) => {
    expect(val).toBe("world");
  });
  await asyncState.setItem("hello4", "world");
});

test("subscribe (model)", async () => {
  let i = 0;

  asyncState.$((val: string) => {
    i++;
    if (1 === i) expect(val).toBe("hello4");
    if (2 === i) expect(val).toBe("hello5");
  });

  await asyncState.setItem("hello5", "world");
});

test("subscribe (batch)", async () => {
  let i = 0;
  batch$([asyncState.data.hello6$, asyncState.data.hello7$], (val, key) => {
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
  await asyncState.setItem("hello6", "world6");
  await asyncState.setItem("hello7", "world7");
});

test("subscribe (auto)", async () => {
  let i = 0;
  asyncState.auto$(async () => {
    i++;
    if (1 === i) expect(await asyncState.data.hello8).toBe(undefined);
    if (2 === i) expect(await asyncState.data.hello8).toBe("hello");
  });

  await asyncState.setItem("hello8", "hello");
});

test("bread (bulk)", async () => {
  // set
  expect(
    await asyncState.bulkSetItem({
      "9": "hello",
      hello2: "world",
    })
  ).toBe(true);

  // get
  const res = await asyncState.bulkGetItem([
    "hello1",
    "9",
    "hello2",
    "hello3",
    "hello4",
  ]);

  let i = 0;
  for (const key in res) {
    if (0 === i) expect(key).toBe("hello1");
    if (1 === i) expect(key).toBe("9");
    if (2 === i) expect(key).toBe("hello2");
    if (3 === i) expect(key).toBe("hello3");
    if (4 === i) expect(key).toBe("hello4");
    i++;
  }

  // remove
  expect(
    await asyncState.bulkRemoveItem(["9", "hello2", "hello3", "hello4"])
  ).toBe(true);
  expect(await asyncState.data["9"]).toBe(undefined);
  expect(await asyncState.data["hello2"]).toBe(undefined);
  expect(await asyncState.data["hello3"]).toBe(undefined);
  expect(await asyncState.data["hello4"]).toBe(undefined);
});
