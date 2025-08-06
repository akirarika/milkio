import { glob } from "glob";
import { join } from "node:path";
import { env } from "node:process";
import type { MilkioAdapter, ViteInput, ViteOutput } from "./index.ts";
import fs from "fs-extra";

const adapterName = "edge-one";

export function edgeOneAdapter(): MilkioAdapter {
  return {
    name: adapterName,
    adapter: async (options: {}) => {
      /**
       * ------------------------------------------------------------------------------------------------
       * @step input
       * ------------------------------------------------------------------------------------------------
       */
      const input: ViteInput = {};
      const results = await glob("modules/**/*.{action,stream}.ts");
      const tasks: Array<Promise<void>> = [];
      for (const modulePath of results) {
        tasks.push(
          (async () => {
            const pathSplit = modulePath
              .replaceAll("\\", "/")
              .slice(0, modulePath.length - 10) // 10 === ".action.ts".length or ".stream.ts".length
              .split("/")
              .slice(1);
            const level = pathSplit.length;
            const path = pathSplit.join("/");
            const backToRoot = "../".repeat(level + 1);
            const routesFolder = `.milkio/generated/routes/module__${path.replaceAll("/", "__").replaceAll("-", "_")}`;

            // Traverse the routes generated in the directory and select the latest piece of data
            const routesFolderFiles = await fs.readdir(routesFolder);
            if (routesFolderFiles.length === 0) throw new Error(`No routes found in ${routesFolder}`);
            // Retrieve the full paths and status information of all files
            const filesWithStats = await Promise.all(
              routesFolderFiles.map(async (file) => {
                const filePath = join(routesFolder, file);
                const stats = await fs.stat(filePath);
                return { filePath, birthTime: stats.birthtime };
              }),
            );
            const routePath = filesWithStats.sort((a, b) => b.birthTime.getTime() - a.birthTime.getTime()).at(0)?.filePath;
            if (!routePath) throw new Error(`No routes found in ${routesFolder}`);

            const generatedPath = `.milkio/${adapterName}/${path}.ts`;
            await fs.outputFile(
              generatedPath,
              `import { create } from "${backToRoot}index.ts";
import routeSchema from "${backToRoot}${routePath.replaceAll("\\", "/")}";

const world = create({
  develop: ${env.COOKBOOK_DEVELOP === "ENABLE" ? "true" : "false"},
});

export async function onRequest(context) {
  return await (await world).listener.fetch({
    request: context.request,
    env: context.env,
    envMode: "${env.MODE ?? "development"}",
    routeSchema,
  });
}`,
            );

            input[path] = generatedPath;
          })(),
        );
      }
      await Promise.all(tasks);

      /**
       * ------------------------------------------------------------------------------------------------
       * @step output
       * ------------------------------------------------------------------------------------------------
       */
      const output: ViteOutput = {};
      output.entryFileNames = "functions/[name].js";
      output.chunkFileNames = "functions/.milkio/[name]-[hash].js";
      output.assetFileNames = "functions/.milkio/[name]-[hash][extname]";
      output.sourcemap = "inline";
      output.preserveModules = false;

      return { input, output };
    },
  } satisfies MilkioAdapter;
}
