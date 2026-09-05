import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "milkio",
    include: ["**/*.test.ts"],
  },
});
