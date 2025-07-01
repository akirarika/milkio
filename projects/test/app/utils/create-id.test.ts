import { expect, test } from "vitest";
import { createId } from "./create-id.ts";

test.sequential("basic", async () => {
  const ids = new Set<string>();
  for (let index = 0; index < 16; index++) ids.add(createId());
  console.log(ids);
  expect(ids.size).toBe(16);
  const id = ids.values().next().value!.length;
  expect(id).toBe(24);
});
