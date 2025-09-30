import { expect, it } from "vitest";
import { astra } from "../../../test.ts";

it.sequential("basic", async () => {
    const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/hello-world", {
        params: {
            a: "2",
            b: 2,
        },
    });
    if (error) throw reject("Milkio did not execute successfully", error);

    // Check if the return value is as expected
    expect(results.count).toBe(4);
});

it.sequential("reject", async () => {
    const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/hello-world", {
        params: {
            a: "2",
            b: 2,
            throw: true,
        },
    });
    if (!error) throw reject("Milkio execution was successful, but expectations should have failed", results);
    if (!error.REQUEST_FAIL) throw reject("Type is not 'FAIL'");

    // Check if the return value is as expected
    expect(error.REQUEST_FAIL).toBe("Reject this request");
});
