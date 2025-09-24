import { expect, it } from "vitest";
import { astra } from "../../../test.ts";

it.sequential("basic", async () => {
    const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/action/call-private-function", {
        params: { username: "foo", password: "bar" },
    });
    if (error) throw reject("Milkio did not execute successfully", error);

    // Check if the return value is as expected
    expect(results.username).toBe("foo");
    expect(results.baz).toBe("baz");
});

