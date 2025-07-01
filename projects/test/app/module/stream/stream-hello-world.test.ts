import { expect, test } from "vitest";
import { astra } from "../../../test.ts";

test.sequential("basic", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/stream/stream-hello-world", {
    type: "stream",
    params: {
      a: "2",
      b: 8,
      sleep: 0,
    },
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  const values: Array<number> = [];
  for await (const [error, result] of results) {
    if (error) throw reject("Milkio did not execute successfully", error);
    values.push(result);
  }

  // Check if the return value is as expected
  expect(values).toEqual([4, 8, 16, 32, 64, 128, 256, 512]);
});

test.sequential("sleep", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/stream/stream-hello-world", {
    type: "stream",
    params: {
      a: "2",
      b: 8,
      sleep: 100,
    },
  });
  context.logger.info(error);
  if (error) throw reject("Milkio did not execute successfully", error);

  const values: Array<number> = [];
  for await (const [error, result] of results) {
    if (error) throw reject("Milkio did not execute successfully", error);
    values.push(result);
  }

  // Check if the return value is as expected
  expect(values).toEqual([4, 8, 16, 32, 64, 128, 256, 512]);
});
