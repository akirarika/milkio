import type { $context, MilkioInit, MilkioRuntimeInit } from "../index.ts";
import { sendCookbookEvent } from "../utils/send-cookbook-event.ts";

export type Log = ["(debug)" | "(info)" | "(warn)" | "(error)" | "(request)" | "(response)", string /* executeId */, string, string, string, ...Array<unknown>];

export interface Logger {
    _: {
        logs: Array<Log>;
        tags: Map<string, unknown>;
        submit: (context: $context) => Promise<void> | void;
    };
    setTag: (key: string, value: unknown) => void;
    setLog: (...log: Log) => void;
    debug: (description: string, ...params: Array<unknown>) => Log;
    info: (description: string, ...params: Array<unknown>) => Log;
    warn: (description: string, ...params: Array<unknown>) => Log;
    error: (description: string, ...params: Array<unknown>) => Log;
    request: (description: string, ...params: Array<unknown>) => Log;
    response: (description: string, ...params: Array<unknown>) => Log;
}

export type LoggerInsertingHandler = (log: Log) => boolean;

export type LoggerSubmittingHandler = (context: $context, logs: Array<Log>, tags: Map<string, unknown>) => Promise<void> | void;

function fastTimestamp(): string {
    const d = new Date();
    return `(${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")})`;
}

// Pre-created default inserting handler - shared across all loggers
const defaultInserting = (log: Log): boolean => {
    log[0] = `\n${log[0]}` as any;
    console.log(...log);
    return true;
};

export function createLogger<MilkioRuntime extends MilkioRuntimeInit<MilkioRuntimeInit<MilkioInit>> = MilkioRuntimeInit<MilkioInit>>(runtime: MilkioRuntime, path: string, executeId: string): Logger {
    const logger = {} as Logger;

    const logs: Array<Log> = [];
    const tags: Map<string, unknown> = new Map();

    const inserting = runtime.onLoggerInserting || defaultInserting;
    const hasSubmitting = !!runtime.onLoggerSubmitting;
    const isDevelop = runtime.develop;

    logger._ = {
        logs,
        tags,
        submit: (context: $context) => {
            if (!runtime.onLoggerSubmitting) return;
            return runtime.onLoggerSubmitting(context, logs, tags);
        },
    };

    const __tagPush = (key: string, value: unknown): void => {
        tags.set(key, value);
    };
    const __logPush = (log: Log): Log => {
        if (!inserting(log)) return log;
        if (hasSubmitting) logs.push([...log]);
        if (isDevelop) void sendCookbookEvent(runtime, { type: "milkio@logger", log });
        return log;
    };

    logger.setTag = __tagPush;
    logger.setLog = (...log: Log) => __logPush(log);

    const getNow = fastTimestamp;

    logger.debug = (description: string, ...params: Array<unknown>) => __logPush(["(debug)", path, executeId, getNow(), `\n${description}`, ...params]);
    logger.info = (description: string, ...params: Array<unknown>) => __logPush(["(info)", path, executeId, getNow(), `\n${description}`, ...params]);
    logger.warn = (description: string, ...params: Array<unknown>) => __logPush(["(warn)", path, executeId, getNow(), `\n${description}`, ...params]);
    logger.error = (description: string, ...params: Array<unknown>) => __logPush(["(error)", path, executeId, getNow(), `\n${description}`, ...params]);
    logger.request = (description: string, ...params: Array<unknown>) => __logPush(["(request)", path, executeId, getNow(), `\n${description}`, ...params]);
    logger.response = (description: string, ...params: Array<unknown>) => __logPush(["(response)", path, executeId, getNow(), `\n${description}`, ...params]);

    return logger;
}
