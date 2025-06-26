import { bootstrap } from "milkio";
import type { MilkioWorld } from "milkio";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../.milkio/drizzle-schema.ts";

export const loadDrizzle = bootstrap(async (world: MilkioWorld) => {
  const db = drizzle({ schema });

  world.on("milkio:executeBefore", async (event) => {
    event.context.db = db;
  });
});
