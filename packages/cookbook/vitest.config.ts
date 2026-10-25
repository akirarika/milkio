import { defineProject } from "vite-plus/test/config";

export default defineProject({
  test: {
    name: "cookbook",
    include: ["src/**/*.test.ts"],
  },
});
