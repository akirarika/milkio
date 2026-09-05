import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "milkio-drizzle",
    include: ["**/*.test.ts"],
  },
});
