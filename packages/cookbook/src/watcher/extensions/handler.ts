import { join } from "node:path";
import { defineWatcherExtension } from "../extensions";

export const handlerWatcherExtension = defineWatcherExtension({
  async: false,
  filter: (file) => {
    return file.type === "handler";
  },
  setup: async (root, mode, options, project, changeFiles, allFiles) => {
    const writePath = join(root, ".milkio", "handler-schema.ts");

    let typescriptImports = "// handler-schema";
    let typescriptExports = "export default {";
    typescriptExports += "\n  loadHandlers:(world: any) => ([";

    for await (const file of allFiles) {
      typescriptImports += `\nimport ${file.importName} from "../${file.path}";`;
      typescriptExports += `\n    ${file.importName}(world),`;
    }
    typescriptExports += "\n  ]),";
    typescriptExports += "\n}";
    const typescript = `${typescriptImports}\n\n${typescriptExports}`;

    await Bun.write(writePath, typescript);
  },
});
