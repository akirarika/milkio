import { expect, it } from "vite-plus/test";
import { astra } from "../../../test.ts";

it("basic", async () => {
    const [context, fail, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/context/context", {
        params: {},
        generateParams: false,
    });
    if (error) throw fail("Milkio did not execute successfully", error);

    // Check if the return value is as expected
    // In /app/context.ts, the result is actually "fail", but the result was modified in /index.ts, so this test should pass
    expect(results.success).toBe("success");
});
