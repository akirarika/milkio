import { defineConfig } from "vite";
import { join } from "node:path";
import { cwd, env } from "node:process";
import { getRequestListener } from "@hono/node-server";
import { existsSync, readdirSync } from "node:fs";
import { createRequestListener } from "@mjackson/node-fetch-server";

export default defineConfig(({ command }) => ({
  build: {
    manifest: true,
    sourcemap: true,
  },
  plugins: [
    {
      name: "server",
      async configureServer(server) {
        const milkio = await (await import("./index.ts")).create();
        server.middlewares.use(async (req, res, next) => {
          try {
            return await createRequestListener(async (request: Request) => {
              milkio.listener.fetch({
                request,
                env: env,
                envMode: env.MILKIO_DEVELOP === "ENABLE" ? "development" : "production",
              });
              return new Response("Hello, world!");
            })(req, res);
          } catch (e) {
            return next(e);
          }
        });
      },
    },
  ],
  ssr: // Make vite package dependencies together
    command === "serve"
      ? void 0
      : {
          noExternal: [...(existsSync(join(cwd(), "node_modules")) ? readdirSync(join(cwd(), "node_modules")) : []), ...readdirSync(join(cwd(), "..", "..", "node_modules"))]
            .filter((dependency) => ["electron"].find((lib) => lib === dependency))
            .map((dependency) => (dependency.startsWith("@") ? new RegExp(`^${dependency}/`) : dependency)),
        },
}));
