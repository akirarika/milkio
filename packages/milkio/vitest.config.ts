import { defineProject } from "vite-plus/test/config";

export default defineProject({
  test: {
    name: "milkio",
    include: ["**/*.test.ts"],
  },
});
