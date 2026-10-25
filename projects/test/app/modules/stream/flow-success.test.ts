import { expect, test } from "vite-plus/test";
import { astra } from "../../../test.ts";

test("basic", async () => {
    const [context, fail, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/stream/flow-success~", {
        type: "stream",
        generateParams: false,
    });
    if (error) throw fail("Milkio did not execute successfully", error);

    const values: Array<{ counter: number } | null> = [];
    for await (const [error, result] of results) {
        if (error) throw fail("Milkio did not execute successfully", error);
        values.push(result);
    }

    // Check if the return value is as expected
    expect(values).toEqual([{ counter: 500 }, { counter: 1000 }, { counter: 1500 }]);
});
