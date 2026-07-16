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

        let metaIndex = 0;
        const metaKeys: string[] = [];
        for await (const file of allFiles) {
            header += `\nimport type { _ as meta_${metaIndex} } from "../app/${file.path}";`;
            metaKeys.push(`meta_${metaIndex}`);
            ++metaIndex;
        }
        if (metaKeys.length > 0) {
            const omitKeys = metaKeys.map((k) => `keyof ${k}`).join(" | ");
            content += `\nexport interface MilkioMeta extends Omit<$meta, ${omitKeys}>`;
            for (const k of metaKeys) {
                content += `, ${k}`;
            }
        } else {
            content += "\nexport interface MilkioMeta extends $meta";
        }
        content += " {}";

        return [header, types, content];
    },
});
