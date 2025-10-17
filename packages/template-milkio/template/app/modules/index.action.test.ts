import { test } from "vitest";
import { astra } from "../utils/astra";

test("adjust", async () => {
    const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
    await world.execute("/", {
        generateParams: true
    });
});