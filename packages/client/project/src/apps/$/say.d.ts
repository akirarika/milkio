export declare const api: {
    meta: {};
    action(params: {
        commands: Array<string>;
        options: Record<string, string | true>;
    }, context: import("milkio").MilkioContext): Promise<{
        commands: Array<string>;
        options: Record<string, string | true>;
    }>;
} & {
    isApi: true;
};
