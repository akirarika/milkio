import * as http from "node:http";
import { createRequestListener } from "@mjackson/node-fetch-server";
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

  // Node.js HTTP adapter (replaces the former Bun-only server):
  // @mjackson/node-fetch-server translates each node:http request into a web
  // `Request`, and writes the web `Response` returned by the milkio listener
  // back to the socket (streaming included).
  const serve = http.createServer(
    createRequestListener(async (request) => {
      return world.listener.fetch({
        request,
        env: process.env,
        envMode: "production",
      });
    }),
  );

  // The previous server implementation started listening before returning;
  // node's listen() is async. Await the "listening" event so callers
  // (packages/cookbook dev.ts / test.ts) receive a live URL, and surface bind
  // errors (e.g. EADDRINUSE) as rejections.
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      serve.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      serve.off("error", onError);
      resolve();
    };
    serve.once("error", onError);
    serve.once("listening", onListening);
    serve.listen(options.port);
  });

  return {
    world,
    serve,
    // The previous server handle exposed `stop()`; expose the Node equivalent
    // so callers can shut the cookbook server down explicitly.
    stop: () => serve.close(),
  };
}

export type World = Awaited<ReturnType<typeof startCookbookServer>>["world"];

export const create = (..._: Array<any>): any => {
  throw new Error("Not implemented");
};
