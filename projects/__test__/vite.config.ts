import { defineConfig } from "vite";
import { join } from "node:path";
import { cwd, env } from "node:process";
import { existsSync, readdirSync } from "node:fs";
import { createRequestListener } from "@mjackson/node-fetch-server";

export default defineConfig(({ command }) => ({
  server: {
    port: 9000,
  },
  build: {
    manifest: true,
    sourcemap: true,
  },
  plugins: [
    {
      name: "server",
      async configureServer(server) {
        const milkio = await (await import("./index.ts")).create({
          develop: env.MILKIO_DEVELOP === "ENABLE",
          argv: process.argv,
        });
        server.middlewares.use(async (req, res, next) => {
          try {
            return await createRequestListener(async (request: Request) => {
              return await milkio.listener.fetch({
                request,
                env: env,
                envMode: env.MILKIO_DEVELOP === "ENABLE" ? "development" : "production",
              });
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
