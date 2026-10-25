import { expect, it } from "vite-plus/test";
import { astra } from "../../../test.ts";
// import { generated } from "../../../.milkio/index.ts";

it("basic", async () => {
    const [context, fail, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/action/action-return-null", {
        params: {
            //
        },
        generateParams: true,
    });
    if (error) throw fail("Milkio did not execute successfully", error);

    expect(results).toEqual({});
});

// const foo : (typeof generated)["routeSchema"]["/action/action-return-null"]["module"] = undefined as any;