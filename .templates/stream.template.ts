import { createTemplate } from "@milkio/cookbook-template";
import { join } from "node:path";

await createTemplate(async (tools) => {
  return {
    path: join(tools.directory(), `${tools.hyphen(tools.name())}.action.ts`),
    content: `
import { stream } from "milkio";

/**
 * ${tools.name()}
 */
export default stream({
  async *handler(
    context,
    params: {
      /* your params.. */
    },
  ) {
    yield "hello,";
    yield "world!";
  }
});`.trim(),
  };
});

await createTemplate(async (tools) => {
  return {
    path: join(tools.directory(), `${tools.hyphen(tools.name())}.test.ts`),
    content: `
import { expect, test } from "vitest";
import { astra } from "../test.ts";

test.sequential("basic", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("${tools.route()}", {
    params: {
      //
    },
    generateParams: true,
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  // Check if the return value is as expected
  // ...
});`.trim(),
  };
});
