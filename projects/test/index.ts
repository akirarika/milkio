import { createWorld, type MilkioInit } from "milkio";
import { generated } from "./.milkio/index.ts";
import { configSchema } from "./.milkio/config-schema.ts";
import { loadDrizzle } from "./bootstrap/drizzle/index.ts";

export async function create(options: MilkioInit) {
  const world = await createWorld(generated, configSchema, {
    ...options,
    bootstraps: [loadDrizzle],
  });

  return world;
}

export type World = Awaited<ReturnType<typeof create>>;
