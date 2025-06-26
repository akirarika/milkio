import { env } from "bun";
import { createWorld } from "milkio";
import { generated } from "./.milkio/index.ts";
import { configSchema } from "./.milkio/config-schema.ts";

const worldPromise = Promise.withResolvers();

export const useCookbookWorld = () => worldPromise.promise;

export async function startCookbookServer(options: { port: number; accessKey: string }) {
  const world = await createWorld(generated, configSchema, {
    port: options.port,
    accessKey: options.accessKey,
    develop: false,
  });

  worldPromise.resolve(world);

  const serve = Bun.serve({
    port: options.port,
    async fetch(request) {
      return world.listener.fetch({
        request,
        env,
        envMode: "production",
      });
    },
  });

  return { world, serve };
}

export type World = Awaited<ReturnType<typeof startCookbookServer>>["world"];

export const create = (..._: Array<any>): any => {
  throw new Error("Not implemented");
};
