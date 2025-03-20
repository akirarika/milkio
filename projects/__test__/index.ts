import { createWorld } from "milkio";
import { generated } from "./.milkio";
import { configSchema } from "./.milkio/config-schema";

export async function create() {
  const world = await createWorld(generated, configSchema, {
    port: 9000,
    cookbook: { cookbookPort: 8000 },
    // develop: env.MILKIO_DEVELOP === "ENABLE",
    // argv: process.argv,
    develop: true,
    argv: [],
  });

  return world;
}

export type World = Awaited<ReturnType<typeof create>>;
