import { join } from "node:path";
import { defineWatcherExtension } from "../extensions";

export const seedWatcherExtension = defineWatcherExtension({
    async: false,
    filter: (file) => {
        return file.type === "seed";
    },
    setup: async (root, mode, options, project, changeFiles, allFiles) => {
        const writePath = join(root, ".milkio", "seed.ts");

        let typescriptImports = "// seed";
        let typescriptExports = `export const executeSeed = async (params: Record<any, any>): Promise<void> => {`;
        typescriptExports += `\n  const mixParams: any = { ...params, mode: "${mode}" };`;
        typescriptExports += `\n  const tasks: Array<Promise<any>> = [];`;

        let index = 0;
        for await (const file of allFiles) {
            typescriptImports += `\nimport * as seed\$${index} from "../app/${file.path}";`;
            typescriptExports += `\n  if ("onSeed" in seed\$${index} && typeof seed\$${index}["onSeed"] === "function") tasks.push(seed\$${index}.onSeed(mixParams));`;
            ++index;
        }
        typescriptExports += `\n  await Promise.all(tasks);`;
        typescriptExports += `\n};`;
        const typescript = `${typescriptImports}\n\n${typescriptExports}\n`;

        await Bun.write(writePath, typescript);
    },
});

