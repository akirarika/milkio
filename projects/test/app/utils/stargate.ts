import { createStargate } from "@milkio/stargate";
import type { generated } from "../../.milkio/index.ts";

// A server-side stargate used by passthrough test actions. It points at this
// project's own dev server; the framework handles the nested request fine.
export const stargate = await createStargate<typeof generated>({
    baseUrl: "http://localhost:9000",
});
