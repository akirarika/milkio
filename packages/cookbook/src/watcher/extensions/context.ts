import { defineWatcherExtension } from "../extensions";

export const contextWatcherExtension = defineWatcherExtension({
    async: true,
    filter: (file) => {
        return file.type === "context";
    },
    declares: async (root, mode, options, project, changeFiles, allFiles) => {
        let header = "";
        const types = "";
        let content = "";

        content += "\nexport interface MilkioContext extends $context";
        let contextIndex = 0;
        for await (const file of allFiles) {
            header += `\nimport type { _ as context_${contextIndex} } from "../app/${file.path}";`;
            content += ", ";
            content += `context_${contextIndex}`;
            ++contextIndex;
        }
        content += " {}";

        return [header, types, content];
    },
});
