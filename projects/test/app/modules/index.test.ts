import { expect, it } from "vite-plus/test";
import { astra } from "../../test.ts";

it("basic", async () => {
    const [context, fail, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/" /* There is no need to pass in /index here, it will be automatically omitted */, {
        params: {
            a: "2",
            b: 2,
        },
        generateParams: false,
    });
    if (error) throw fail("Milkio did not execute successfully", error);

    // Check if the return value is as expected
    expect(results.count).toBe(4);
});
