import { join } from "node:path";
import { cwd, env } from "node:process";
import { existsSync, readdirSync } from "node:fs";
import { VitePluginNode } from "vite-plugin-node";
import { createRequestListener } from "@mjackson/node-fetch-server";
import type { PluginOption } from "vite";

export function useVitePluginMilkio() {
  return [
    ...VitePluginNode({
      async adapter({ app, server, req, res, next }) {
        const milkio = await await app({
          develop: env.MILKIO_DEVELOP === "ENABLE",
          argv: process.argv,
        });
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
      },
      appPath: "./index.ts",
      exportName: "create",
      initAppOnBoot: true,
    }),
    {
      name: "vite-plugin-milkio",
      config(config, { command }) {
        if (command !== "build") return;
        const main = "./runtime/node.ts";
        if (!config.build) config.build = {};
        config.build.ssr = main;
        if (!config.build.rollupOptions) config.build.rollupOptions = {};
        config.build.rollupOptions.input = main;
        if (!config.build.rollupOptions.output) config.build.rollupOptions.output = {};
        (config.build.rollupOptions.output as any).format = "es";
        config.ssr = {
          noExternal: [...(existsSync(join(cwd(), "node_modules")) ? readdirSync(join(cwd(), "node_modules")) : []), ...(existsSync(join(cwd(), "..", "..", "node_modules")) ? readdirSync(join(cwd(), "..", "..", "node_modules")) : [])]
            .filter((dependency) => !dependency.startsWith(".") && ["electron"].find((lib) => lib !== dependency))
            .map((dependency) => (dependency.startsWith("@") ? new RegExp(`^${dependency}/`) : dependency)),
        };
      },
    },
  ] satisfies PluginOption[];
}
