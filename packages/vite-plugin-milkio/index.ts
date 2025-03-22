import { join } from "node:path";
import { cwd, env } from "node:process";
import { existsSync, readdirSync } from "node:fs";
import { createRequestListener } from "@mjackson/node-fetch-server";

export type VitePluginMilkioOptions = {
  command: "build" | "serve";
};

export function useVitePluginMilkio(options: VitePluginMilkioOptions) {
  return {
    milkioPlugin: (milkio: () => Promise<{ create: () => any }>) => ({
      name: "vite-plugin-milkio",
      async configureServer(server: any) {
        server.middlewares.use(async (req: any, res: any, next: any) => {
          try {
            return await createRequestListener(async (request: Request) => {
              const world: any = await milkio();
              return await world.listener.fetch({
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
    }),
    ssr: // Make vite package dependencies together
      options.command === "serve"
        ? void 0
        : {
            noExternal: [...(existsSync(join(cwd(), "node_modules")) ? readdirSync(join(cwd(), "node_modules")) : []), ...(existsSync(join(cwd(), "..", "..", "node_modules")) ? readdirSync(join(cwd(), "..", "..", "node_modules")) : [])]
              .filter((dependency) => ["electron"].find((lib) => lib === dependency))
              .map((dependency) => (dependency.startsWith("@") ? new RegExp(`^${dependency}/`) : dependency)),
          },
  };
}
