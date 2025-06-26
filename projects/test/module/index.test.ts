import { expect, it } from "vitest";
import { astra } from "../../test.ts";

it.sequential("basic", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/" /* There is no need to pass in /index here, it will be automatically omitted */, {
    params: {
      a: "2",
      b: 2,
    },
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  // Check if the return value is as expected
  expect(results.count).toBe(4);
});
