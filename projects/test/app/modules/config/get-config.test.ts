import { expect, it } from "vite-plus/test";
import { astra } from "../../../test.ts";

it("basic", async () => {
    const [context, fail, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/config/get-config", {
        params: {},
        generateParams: false,
    });
    if (error) throw fail("Milkio did not execute successfully", error);

    // Check if the return value is as expected
    expect(results.foo).toBe("test");
    expect(results.baz).toBe("baz");
});
