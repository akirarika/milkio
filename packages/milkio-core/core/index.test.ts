import { expect, test } from "vitest";

test("random", async () => {
  const a = new Promise((r) => setTimeout(() => r(1), 2000));
  expect(await a).toBe(1);
  console.log("hello world");
});
