import { defineConfig } from "vite";
import { useVitePluginMilkio } from "@milkio/vite-plugin-milkio";

export default defineConfig(async ({ command }) => {
  return {
    server: {
      port: 9000,
    },
    resolve: {},
    plugins: [useVitePluginMilkio()],
  };
});
