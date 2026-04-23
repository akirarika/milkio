import { defineWatcherExtension } from "../extensions";

export const eventWatcherExtension = defineWatcherExtension({
    async: true,
    filter: (file) => {
        return file.type === "event";
    },
    declares: async (root, mode, options, project, changeFiles, allFiles) => {
        let header = "";
        const types = "";
        let content = "";

        content += `\ntype $eventsMixin = {
    "*": { key: keyof $events, value: any };
    "milkio:httpRequest": { executeId: string; path: string; logger: Logger; http: ContextHttp<Record<string, any>>, reject: MilkioRejectFunction };
    "milkio:httpResponse": { executeId: string; path: string; logger: Logger; http: ContextHttp<Record<string, any>>; context: MilkioContext; success: boolean, reject: MilkioRejectFunction };
    "milkio:httpNotFound": { executeId: string; path: string; logger: Logger; http: ContextHttp<Record<string, any>>, reject: MilkioRejectFunction };
    "milkio:executeBefore": { executeId: string; path: string; logger: Logger; meta: MilkioMeta; context: MilkioContext, reject: MilkioRejectFunction };
    "milkio:executeAfter": { executeId: string; path: string; logger: Logger; meta: MilkioMeta; context: MilkioContext; results: Results<any>, reject: MilkioRejectFunction };
}`;
        content += "\nexport interface MilkioEvents extends $eventsMixin";
        let eventIndex = 0;
        for await (const file of allFiles) {
            header += `\nimport type { _ as event_${eventIndex} } from "../app/${file.path}";`;
            content += ", ";
            content += `event_${eventIndex}`;
            ++eventIndex;
        }
        content += " {}";

        return [header, types, content];
    },
});
