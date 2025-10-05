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
    "milkio:httpRequest": { executeId: string; path: string; logger: Logger; http: ContextHttp<Record<string, any>>, reject: <Code extends keyof MilkioRejectCode, RejectData extends MilkioRejectCode[Code]>(code: Code, data: RejectData) => MilkioRejectError<Code, RejectData> };
    "milkio:httpResponse": { executeId: string; path: string; logger: Logger; http: ContextHttp<Record<string, any>>; context: MilkioContext; success: boolean, reject: <Code extends keyof MilkioRejectCode, RejectData extends MilkioRejectCode[Code]>(code: Code, data: RejectData) => MilkioRejectError<Code, RejectData> };
    "milkio:httpNotFound": { executeId: string; path: string; logger: Logger; http: ContextHttp<Record<string, any>>, reject: <Code extends keyof MilkioRejectCode, RejectData extends MilkioRejectCode[Code]>(code: Code, data: RejectData) => MilkioRejectError<Code, RejectData> };
    "milkio:executeBefore": { executeId: string; path: string; logger: Logger; meta: $meta; context: MilkioContext, reject: <Code extends keyof MilkioRejectCode, RejectData extends MilkioRejectCode[Code]>(code: Code, data: RejectData) => MilkioRejectError<Code, RejectData> };
    "milkio:executeAfter": { executeId: string; path: string; logger: Logger; meta: $meta; context: MilkioContext; results: Results<any>, reject: <Code extends keyof MilkioRejectCode, RejectData extends MilkioRejectCode[Code]>(code: Code, data: RejectData) => MilkioRejectError<Code, RejectData> };
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
