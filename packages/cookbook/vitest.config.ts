import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "cookbook",
    include: ["src/**/*.test.ts"],
  },
});
