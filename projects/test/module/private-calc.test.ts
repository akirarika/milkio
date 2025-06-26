import { it } from "vitest";
import { astra } from "../test.ts";

it.sequential("basic", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/_/private-calc", {
    params: {
      a: "2",
      b: 3,
    },
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  // Check if the return value is as expected
  // ...
});
