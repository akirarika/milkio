import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fileParallelism: false,
    projects: [
      "packages/*/vitest.config.ts",
      "projects/*/vitest.config.ts",
    ],
  },
})
