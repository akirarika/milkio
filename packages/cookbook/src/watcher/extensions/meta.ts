import { defineWatcherExtension } from "../extensions";

export const metaWatcherExtension = defineWatcherExtension({
    async: true,
    filter: (file) => {
        return file.type === "meta";
    },
    declares: async (root, mode, options, project, changeFiles, allFiles) => {
        let header = "";
        const types = "";
        let content = "";

        content += "\n  interface MilkioMeta";
        let metaIndex = 0;
        for await (const file of allFiles) {
            header += `\nimport type { _ as meta_${metaIndex} } from "../app/${file.path}";`;
            if (metaIndex > 0) content += ", ";
            else content += " extends ";
            content += `meta_${metaIndex}`;
            ++metaIndex;
        }
        content += " {}";

        return [header, types, content];
    },
});
