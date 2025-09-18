import { expect, it } from "vitest";
import { astra } from "../../../test.ts";

it.sequential("basic", async () => {
    const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/action/action-return-null", {
        params: {
            //
        },
        generateParams: true,
    });
    if (error) throw reject("Milkio did not execute successfully", error);

    expect(results).toEqual({});
});
