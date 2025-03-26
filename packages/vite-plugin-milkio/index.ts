import { join, resolve } from "node:path";
import { cwd, env } from "node:process";
import { existsSync, readdirSync } from "node:fs";
import { VitePluginNode, type ModuleFormat } from "vite-plugin-node";
import { createRequestListener } from "@mjackson/node-fetch-server";
import type { PluginOption } from "vite";

export function useVitePluginMilkio(options?: {
  outputFormat?: ModuleFormat;
}) {
  return [
    ...VitePluginNode({
      async adapter({ app, server, req, res, next }) {
        (globalThis as any).viteServer = server;
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
          if (e instanceof Error) server.ssrFixStacktrace(e);
          return next(e);
        }
      },
      appPath: "./index.ts",
      exportName: "create",
      initAppOnBoot: true,
      outputFormat: options?.outputFormat ?? "cjs",
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
        config.ssr = {
          noExternal: [...(existsSync(join(cwd(), "node_modules")) ? readdirSync(join(cwd(), "node_modules")) : []), ...(existsSync(join(cwd(), "..", "..", "node_modules")) ? readdirSync(join(cwd(), "..", "..", "node_modules")) : [])]
            .filter((dependency) => !dependency.startsWith(".") && ["electron"].find((lib) => lib !== dependency))
            .map((dependency) => (dependency.startsWith("@") ? new RegExp(`^${dependency}/`) : dependency)),
        };
      },
    },
  ] satisfies PluginOption[];
}
