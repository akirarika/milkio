import { expect, it } from "vite-plus/test";
import { astra } from "../../../test.ts";

it("basic", { skip: true }, async () => {
    const [context, fail, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/action/type-safety", {
        params: {},
        generateParams: false,
    });
    if (error) throw fail("Milkio did not execute successfully", error);

    expect(results.username).toBe("administrator");
    expect(typeof results.createdAt).toBe("object");
    expect(results.createdAt instanceof Date).toBe(true);
    expect("password" in results).toBe(false);
});
