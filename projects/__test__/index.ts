import { createWorld } from "milkio";
import { generated } from "./.milkio/index.ts";
import { configSchema } from "./.milkio/config-schema.ts";

export async function create(options: { develop: boolean; argv: Array<string> }) {
  const world = await createWorld(generated, configSchema, {
    ...options,
    port: 9000,
    cookbook: { cookbookPort: 8000 },
    develop: options.develop,
    argv: [],
  });

  return world;
}

export type World = Awaited<ReturnType<typeof create>>;
