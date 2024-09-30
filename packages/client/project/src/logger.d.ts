export type LoggerTags = {
    hello: string;
};
export declare const loggerOptions: {
    onSubmit: (tags: import("milkio").MilkioLoggerTags & LoggerTags, logs: import("milkio").LoggerItem[]) => void;
    onInsert: (options: import("milkio").LoggerItem) => true;
};
