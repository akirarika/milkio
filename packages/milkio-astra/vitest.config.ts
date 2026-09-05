import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "milkio-astra",
    include: ["**/*.test.ts"],
  },
});
