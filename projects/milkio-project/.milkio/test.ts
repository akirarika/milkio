import { createStargate } from "@milkio/stargate";
import { createAstra } from "@milkio/astra";
import type { generated } from "./generated";

export const stargate = await createStargate<typeof generated>({
  baseUrl: "http://localhost:9000",
});

export const astra = await createAstra({
  stargate: stargate,
  bootstrap: async () => {
    return {
      world: "world",
    };
  },
});
