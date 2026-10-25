import { expect, test } from "vite-plus/test";
import { astra } from "../../../test.ts";

test("basic", async () => {
    const [context, fail, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/stream/stream-hello-world~", {
        type: "stream",
        params: {
            a: "2",
            b: 8,
            sleep: 0,
        },
        generateParams: false,
    });
    if (error) throw fail("Milkio did not execute successfully", error);

    const values: Array<number> = [];
    for await (const [error, result] of results) {
        if (error) throw fail("Milkio did not execute successfully", error);
        values.push(result.value);
    }

    // Check if the return value is as expected
    expect(values).toEqual([4, 8, 16, 32, 64, 128, 256, 512]);
});

test("sleep", async () => {
    const [context, fail, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/stream/stream-hello-world~", {
        type: "stream",
        params: {
            a: "2",
            b: 8,
            sleep: 100,
        },
        generateParams: false,
    });
    context.logger.info("stream-hello-world sleep 100ms", error);
    if (error) throw fail("Milkio did not execute successfully", error);

    const values: Array<number> = [];
    for await (const [error, result] of results) {
        if (error) throw fail("Milkio did not execute successfully", error);
        values.push(result.value);
    }

    // Check if the return value is as expected
    expect(values).toEqual([4, 8, 16, 32, 64, 128, 256, 512]);
});
