import { expect, test } from "vitest";
import { astra } from "/.milkio/test";

test.sequential("basic", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/action-hello-world", {
    params: {
      a: "2",
      b: 2,
    },
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  // Check if the return value is as expected
  expect(results.count).toBe(4);
  expect("say" in results).toBe(false);
});

test.sequential("reject", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/action-hello-world", {
    params: {
      a: "2",
      b: 2,
      throw: true,
    },
  });
  if (!error) throw reject("Milkio execution was successful, but expectations should have failed", results);
  if (!error.FAIL) throw reject("Type is not 'FAIL'");

  // Check if the return value is as expected
  expect(error.FAIL).toBe("Reject this request");
});
