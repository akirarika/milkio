import { expect, it } from "vitest";
import { astra } from "../../../test.ts";

it.sequential("basic", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/action/type-safety", {
    params: {},
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  expect(results.username).toBe("administrator");
  expect(typeof results.createdAt).toBe("object");
  expect(results.createdAt instanceof Date).toBe(true);
  expect("password" in results).toBe(false);
});
