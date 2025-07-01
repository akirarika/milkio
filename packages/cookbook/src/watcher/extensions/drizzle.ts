import { join } from "node:path";
import { defineWatcherExtension } from "../extensions";

export const drizzleWatcherExtension = defineWatcherExtension({
  async: false,
  filter: (file) => {
    return file.type === "table";
  },
  setup: async (root, mode, options, project, changeFiles, allFiles) => {
    const writePath = join(root, ".milkio", "drizzle-schema.ts");

    let typescriptImports = "// drizzle-schema";

    for await (const file of allFiles) {
      typescriptImports += `\nexport * from "../app/${file.path}";`;
    }
    const typescript = `${typescriptImports}\n`;

    await Bun.write(writePath, typescript);
  },
});
