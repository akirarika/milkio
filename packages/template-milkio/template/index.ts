import { createWorld, type MilkioInit } from "milkio";
import { configSchema } from "./.milkio/config-schema.ts";
import { generated } from "./.milkio/index.ts";

export async function create(options: MilkioInit) {
    const world = await createWorld(generated, configSchema, {
        ...options,
        bootstraps: [],
    });

    return world;
}
