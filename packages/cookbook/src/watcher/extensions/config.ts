import { join } from "node:path";
import { defineWatcherExtension } from "../extensions";

export const configWatcherExtension = defineWatcherExtension({
  async: true,
  filter: (file) => {
    return file.type === "config";
  },
  setup: async (root, mode, options, project, changeFiles, allFiles) => {
    const writePath = join(root, ".milkio", "config-schema.ts");

    let typescriptImports = "// config-schema";
    let typescriptExports = `const mode = "${mode}";`;
    typescriptExports += "\n\nexport const configSchema = { get: async () => {\n  return { mode,";

    for await (const file of allFiles) {
      typescriptImports += `\nimport ${file.importName} from "../app/${file.path}";`;
      typescriptExports += `\n    // @ts-ignore\n    ...(await ${file.importName}(mode)),`;
    }
    typescriptExports += "\n  }\n}}";
    const typescript = `${typescriptImports}\n\n${typescriptExports}`;

    await Bun.write(writePath, typescript);
  },
  declares: async (root, mode, options, project, changeFiles, allFiles) => {
    let header = "";
    let types = "";
    const content = "";

    header += `\nimport type { configSchema } from "./config-schema.ts";`;
    types += "\n    configSchema: typeof configSchema,";

    return [header, types, content];
  },
});
