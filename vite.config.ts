import { defineConfig } from "vite-plus";

export default defineConfig({
  defaultPackage: {
    pack: "./packages/cookbook",
  },
  test: {
    fileParallelism: false,
    projects: ["packages/*/vitest.config.ts", "projects/*/vitest.config.ts"],
  },
});
