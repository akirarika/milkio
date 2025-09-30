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

        content += `\ntype $contextMixin = {
    _: MilkioRuntimeInit<MilkioInit>;
    develop: boolean;
    executeId: string;
    path: string;
    logger: Logger;
    http: ContextHttp<Record<any, any>>;
    headers: Headers;
    config: Readonly<Awaited<ReturnType<(MilkioTypes["configSchema"])["get"]>>>;
    typia: Readonly<MilkioTypes["generated"]["typiaSchema"]>;
    call: <Module extends Promise<Action<any>>>(module: Module, params: Parameters<Awaited<Module>["handler"]>[1]) => Promise<ReturnType<Awaited<Module>["handler"]>>;
    onFinally: (handler: () => void | Promise<void>) => void;
    emit: <Key extends keyof MilkioEvents, Value extends MilkioEvents[Key]>(key: Key, value: Value) => Promise<void>
}`;
        content += "\nexport interface MilkioContext extends $contextMixin";
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
