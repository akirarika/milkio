import { createStargate } from "@milkio/stargate";
import { createAstra } from "@milkio/astra";
import type { generated } from "./.milkio/index.ts";

export const stargate = await createStargate<typeof generated>({
  baseUrl: "http://localhost:9000",
});

export const astra = await createAstra({
  stargate,
  bootstrap: async () => {
    return {
      world: "world",
    };
  },
});
