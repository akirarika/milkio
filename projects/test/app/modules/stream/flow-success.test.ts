import { expect, test } from "vitest";
import { astra } from "../../../test.ts";

test.sequential("basic", async () => {
    const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/stream/flow-success~", {
        type: "stream",
    });
    if (error) throw reject("Milkio did not execute successfully", error);

    const values: Array<{ counter: number } | null> = [];
    for await (const [error, result] of results) {
        if (error) throw reject("Milkio did not execute successfully", error);
        values.push(result);
    }

    // Check if the return value is as expected
    expect(values).toEqual([{ counter: 500 }, { counter: 1000 }, { counter: 1500 }]);
});
