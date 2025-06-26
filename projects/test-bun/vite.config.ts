import { defineConfig } from "vite";
import { useVitePluginMilkio } from "@milkio/vite-plugin-milkio";

export default defineConfig(async ({ command }) => {
  return {
    server: {
      port: 9001,
    },
    build: {
      manifest: true,
      sourcemap: true,
    },
    resolve: {
      // alias: { "/": join(cwd()) },
    },
    plugins: [useVitePluginMilkio()],
  };
});
