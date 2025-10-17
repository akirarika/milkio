import { defineConfig } from "vite";
import { useVitePluginMilkio } from "@milkio/vite-plugin-milkio";

export default defineConfig(async () => {
    return {
        server: {
            port: 9000,
        },
        build: {
            manifest: true,
            sourcemap: true,
        },
        resolve: {
        },
        plugins: [useVitePluginMilkio()],
    };
});
