import TOML from "@iarna/toml";
import { join } from "node:path";
import { cwd, env } from "node:process";
import { existsSync, readdirSync } from "node:fs";
import { createRequestListener } from "@mjackson/node-fetch-server";
import type { PluginOption } from "vite";
import { readFile, writeFile } from "node:fs/promises";
import { adapters } from "./adapters/index.ts";

export function useVitePluginMilkio(options?: {
  outputFormat?: "esm" | "cjs";
}) {
  let outDir = "dist";

  return {
    name: "vite-plugin-milkio",
    async configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const app = await server.ssrLoadModule("index.ts", { fixStacktrace: false });
        const milkio = await app.create({
          port: Number(env.MILKIO_PORT),
          develop: Boolean(env.COOKBOOK_BASE_URL),
          fetchEnv: (key: string) => env[key] ?? undefined,
        });
        try {
          return await createRequestListener(async (request: Request) => {
            return await milkio.listener.fetch({
              request,
              env: env,
              envMode: env.COOKBOOK_DEVELOP === "ENABLE" ? "development" : "production",
            });
          })(req, res);
        } catch (e) {
          if (e instanceof Error) server.ssrFixStacktrace(e);
          return next(e);
        }
      });
    },

    async config(config, { command }) {
      if (command !== "build") return;
      const project = await getCookbookTomlProject();

      // config.build
      if (!config.build) config.build = {};
      config.build.ssr = true;
      config.build.sourcemap = "inline";
      config.build.target = "es2024";
      // config.build.rollupOptions
      if (!config.build.rollupOptions) config.build.rollupOptions = {};
      // config.build.rollupOptions.output
      if (!config.build.rollupOptions.output) config.build.rollupOptions.output = {};
      // config.build.rollupOptions.input
      config.build.rollupOptions.input = {
        index: ".milkio/run.ts",
      };

      if (!project.adapter) {
        let format: "esm" | "cjs" = "esm";
        // oxlint-disable-next-line no-unused-vars
        let mode: "chunk" | "bundle" = "bundle";
        if (project.runtime === "node") {
          format = options?.outputFormat ?? "cjs";
          mode = "chunk";
        } else if (project.runtime === "deno" || project.runtime === "bun") {
          format = options?.outputFormat ?? "esm";
          mode = "chunk";
        } else throw new Error("runtime not supported");
        for (const output of Array.isArray(config.build.rollupOptions.output) ? config.build.rollupOptions.output : [config.build.rollupOptions.output]) {
          output.format = format;
          output.preserveModules = false;
        }
      } else {
        let find = false;
        for (const adapter of adapters) {
          if (adapter.name === project.adapter) {
            find = true;
            const result = await adapter.adapter({
              project,
              command,
              config,
            });
            config.build.rollupOptions.input = result.input;
            config.build.rollupOptions.output = result.output;
            break;
          }
        }
        if (!find) throw new Error(`adapter "${project.adapter}" not found`);
      }

      // config.server
      if (!config.server) config.server = {};
      // config.server.middlewareMode
      config.server.hmr = false;

      // config.optimizeDeps
      if (!config.optimizeDeps) config.optimizeDeps = {};
      config.optimizeDeps.noDiscovery = true;
      if (!config.optimizeDeps.exclude) config.optimizeDeps.exclude = [];
      config.optimizeDeps.exclude.push("@electric-sql/pglite");

      // config.worker
      if (!config.worker) config.worker = {};
      config.worker.format = "es";

      // config.resolve
      if (!config.resolve) config.resolve = {};
      // config.resolve.alias
      config.resolve.alias = {
        ...config.resolve.alias,
      };

      // config.ssr
      config.ssr = {
        noExternal: getNoExternal(),
      };
    },

    configResolved(resolvedConfig) {
      outDir = resolvedConfig.build.outDir || "dist";
    },

    async writeBundle() {
      const filePath = join(cwd(), outDir, ".gitkeep");
      await writeFile(filePath, "", "utf-8");
    },
  } satisfies PluginOption;
}

function getNoExternal() {
  // bun
  const bun = ["bun", /^bun:/];

  // node_modules
  let nodeModules = [...(existsSync(join(cwd(), "node_modules")) ? readdirSync(join(cwd(), "node_modules")) : []), ...(existsSync(join(cwd(), "..", "..", "node_modules")) ? readdirSync(join(cwd(), "..", "..", "node_modules")) : [])].filter((dependency) => !dependency.startsWith("."));
  // electron exclude
  nodeModules = nodeModules.filter((dependency) => dependency !== "electron");
  // startsWith @
  const nodeModulesRegExp = nodeModules.map((dependency) => (dependency.startsWith("@") ? new RegExp(`^${dependency}/`) : dependency));

  return [...bun, ...nodeModulesRegExp];
}

async function getCookbookTomlProject(): Promise<any> {
  const cookbookTomlRaw = await readFile(join(cwd(), "..", "..", "cookbook.toml"), "utf-8");
  const cookbookToml = TOML.parse(cookbookTomlRaw);
  let project: any;
  for (const projectName in cookbookToml.projects as any) {
    // biome-ignore lint/suspicious/noSelfCompare: <explanation>
    if (join(cwd()) !== join(cwd(), "..", projectName)) continue;
    project = (cookbookToml.projects as any)[projectName];
    break;
  }
  if (!project) throw new Error("Project not found in cookbook.toml");
  return project;
}
