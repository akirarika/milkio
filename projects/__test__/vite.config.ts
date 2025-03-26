import { defineConfig } from "vite";
import { useVitePluginMilkio } from "@milkio/vite-plugin-milkio";
import { join } from "node:path";
import { cwd } from "node:process";
// import { join } from "node:path";
// import { cwd, env } from "node:process";
// import { existsSync, readdirSync } from "node:fs";
// import { VitePluginNode } from "vite-plugin-node";
// import { createRequestListener } from "@mjackson/node-fetch-server";

export default defineConfig(async ({ command }) => {
  return {
    server: {
      port: 9000,
    },
    build: {
      manifest: true,
      sourcemap: true,
    },
    resolve: {
      // alias: { "/": join(cwd()) },
    },
    plugins: [
      ...useVitePluginMilkio(),

      // ...VitePluginNode({
      //   async adapter({ app, server, req, res, next }) {
      //     globalThis.viteServer = server;
      //     const milkio = await await app({
      //       develop: env.MILKIO_DEVELOP === "ENABLE",
      //       argv: process.argv,
      //     });
      //     try {
      //       return await createRequestListener(async (request: Request) => {
      //         return await milkio.listener.fetch({
      //           request,
      //           env: env,
      //           envMode: env.MILKIO_DEVELOP === "ENABLE" ? "development" : "production",
      //         });
      //       })(req, res);
      //     } catch (e) {
      //       if (e instanceof Error) server.ssrFixStacktrace(e);
      //       return next(e);
      //     }
      //   },
      //   appPath: "./index.ts",
      //   exportName: "create",
      //   initAppOnBoot: true,
      //   // tsCompiler: "swc",
      // }),
      // {
      //   name: "vite-plugin-milkio",
      //   config(config, { command }) {
      //     if (command !== "build") return;
      //     const main = "./runtime/node.ts";
      //     if (!config.build) config.build = {};
      //     config.build.ssr = main;
      //     if (!config.build.rollupOptions) config.build.rollupOptions = {};
      //     config.build.rollupOptions.input = main;
      //     if (!config.build.rollupOptions.output) config.build.rollupOptions.output = {};
      //     (config.build.rollupOptions.output as any).format = "es";
      //     config.ssr = {
      //       noExternal: [...(existsSync(join(cwd(), "node_modules")) ? readdirSync(join(cwd(), "node_modules")) : []), ...(existsSync(join(cwd(), "..", "..", "node_modules")) ? readdirSync(join(cwd(), "..", "..", "node_modules")) : [])]
      //         .filter((dependency) => !dependency.startsWith(".") && ["electron"].find((lib) => lib !== dependency))
      //         .map((dependency) => (dependency.startsWith("@") ? new RegExp(`^${dependency}/`) : dependency)),
      //     };
      //   },
      // },
    ],
  };
});
