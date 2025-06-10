import { env } from "bun";
import { createWorld } from "milkio";
import { generated } from "./.milkio/index.ts";
import { configSchema } from "./.milkio/config-schema.ts";

export async function create(options: { develop: boolean }) {
  const world = await createWorld(generated, configSchema, {
    ...options,
    port: 8000,
    cookbook: { cookbookPort: 8000 },
    develop: options.develop,
  });

  return world;
}

const world = create({
  develop: false,
});

export const useCookbookWorld = () => world;

export async function startCookbookServer() {
  const world = await create({
    develop: false,
  });
  return Bun.serve({
    port: world.listener.port,
    async fetch(request) {
      return world.listener.fetch({
        request,
        env,
        envMode: "production",
      });
    },
  });
}

export type World = Awaited<ReturnType<typeof create>>;
