import { expect, it } from "vite-plus/test";
import { astra } from "../../../test.ts";

it("basic", async () => {
    const [context, fail, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/hello-world", {
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

it("reject", async () => {
    const [context, fail, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/hello-world", {
        params: {
            a: "2",
            b: 2,
            throw: true,
        },
        generateParams: false,
    });
    if (!error) throw fail("Milkio execution was successful, but expectations should have failed", results);
    if (error.kind !== "fail" || error.code !== "REQUEST_FAIL") throw fail("Type is not 'REQUEST_FAIL'");

    // Check if the return value is as expected
    expect(error.data).toBe("Reject this request");
});
