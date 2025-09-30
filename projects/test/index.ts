import { createWorld, type MilkioInit } from "milkio";
import { generated } from "./.milkio/index.ts";
import { configSchema } from "./.milkio/config-schema.ts";

export async function create(options: MilkioInit) {
    const world = await createWorld(generated, configSchema, {
        ...options,
        bootstraps: [],
    });

    return world;
}

export type World = Awaited<ReturnType<typeof create>>;
