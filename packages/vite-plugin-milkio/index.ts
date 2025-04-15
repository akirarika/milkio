import { glob } from "glob";
import TOML from "@iarna/toml";
import { join } from "node:path";
import { cwd, env } from "node:process";
import { existsSync, readdirSync } from "node:fs";
import { createRequestListener } from "@mjackson/node-fetch-server";
import type { PluginOption } from "vite";
import { readFile, writeFile } from "node:fs/promises";

export function useVitePluginMilkio(options?: {
  outputFormat?: "esm" | "cjs";
}) {
  let outDir = "dist";

  return {
    name: "vite-plugin-milkio",
    async configureServer(server) {
      const app = await server.ssrLoadModule("index.ts", { fixStacktrace: false });
      server.middlewares.use(async (req, res, next) => {
        const milkio = await app.create({
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
      });
    },

    async config(config, { command }) {
      if (command !== "build") return;
      const project = await getCookbookTomlProject();

      let format: "esm" | "cjs";
      let mode: "chunk" | "bundle";
      let prefix = "";
      if (project.platform === "node") {
        format = options?.outputFormat ?? "cjs";
        mode = "chunk";
      } else if (project.platform === "bun") {
        format = options?.outputFormat ?? "esm";
        mode = "chunk";
      } else if (project.platform === "edge-one") {
        format = options?.outputFormat ?? "esm";
        mode = "bundle";
        prefix = "functions/";
      } else throw new Error("Platform not supported");

      // config.build
      if (!config.build) config.build = {};
      config.build.ssr = true;
      // config.build.rollupOptions
      if (!config.build.rollupOptions) config.build.rollupOptions = {};
      // config.build.rollupOptions.input
      if (mode === "chunk") {
        config.build.rollupOptions.input = {
          index: `.platform-${project.platform}/index.ts`,
        };
      } else {
        config.build.rollupOptions.input = {};
        const results = await glob("controller/**/*.{action,stream}.ts");
        for (const path of results) {
          const name = path
            .replaceAll("\\", "/")
            .slice(0, path.length - 10) // 10 === ".action.ts".length or ".stream.ts".length
            .split("/")
            .slice(1)
            .join("/");
          config.build.rollupOptions.input[name] = path;
        }
      }

      // config.build.rollupOptions.output
      if (!config.build.rollupOptions.output) config.build.rollupOptions.output = {};
      for (const output of Array.isArray(config.build.rollupOptions.output) ? config.build.rollupOptions.output : [config.build.rollupOptions.output]) {
        output.chunkFileNames = `${prefix}.milkio/[name]-[hash].js`;
        output.assetFileNames = `${prefix}.milkio/[name]-[hash][extname]`;
        output.format = format;
        output.sourcemap = "inline";
        output.preserveModules = false;
        output.entryFileNames = `${prefix}[name].js`;
      }

      // config.server
      if (!config.server) config.server = {};
      // config.server.middlewareMode
      config.server.hmr = false;

      // config.optimizeDeps
      if (!config.optimizeDeps) config.optimizeDeps = {};
      config.optimizeDeps.noDiscovery = true;

      // config.resolve
      if (!config.resolve) config.resolve = {};
      // config.resolve.alias
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
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
