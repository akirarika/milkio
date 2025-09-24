import { format } from "date-fns";
import type { MilkioContext, MilkioInit, MilkioRuntimeInit } from "../index.ts";
import { sendCookbookEvent } from "../utils/send-cookbook-event.ts";

export type Log = ["(debug)" | "(info)" | "(warn)" | "(error)" | "(request)" | "(response)", string /* executeId */, string, string, string, ...Array<unknown>];

export interface Logger {
    _: {
        logs: Array<Log>;
        tags: Map<string, unknown>;
        submit: (context: MilkioContext) => Promise<void> | void;
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

export type LoggerSubmittingHandler = (context: MilkioContext, logs: Array<Log>, tags: Map<string, unknown>) => Promise<void> | void;

export function createLogger<MilkioRuntime extends MilkioRuntimeInit<MilkioRuntimeInit<MilkioInit>> = MilkioRuntimeInit<MilkioInit>>(runtime: MilkioRuntime, path: string, executeId: string): Logger {
    const logger = {} as Logger;

    logger._ = {
        logs: [],
        tags: new Map(),
        submit: (context: MilkioContext) => {
            if (!runtime.onLoggerSubmitting) return;
            return runtime.onLoggerSubmitting(context, logger._.logs, logger._.tags);
        },
    };

    const __tagPush = (key: string, value: unknown): void => {
        logger._.tags.set(key, value);
    };
    const __logPush = (log: Log): Log => {
        const inserting = runtime.onLoggerInserting
            ? runtime.onLoggerInserting
            : (log: Log) => {
                log = [...log];
                log[0] = `\n${log[0]}` as any;
                console.log(...log);
                return true;
            };

        if (!inserting(log)) return log;

        logger._.logs.push([...log]);

        if (runtime.develop) {
            void sendCookbookEvent(runtime, {
                type: "milkio@logger",
                log,
            });
        }

        return log;
    };

    logger.setTag = (key: string, value: unknown) => __tagPush(key, value);
    logger.setLog = (...log: Log) => __logPush(log);

    const getNow = () => `${format(new Date(), "(yyyy-MM-dd hh:mm:ss)")}`;

    logger.debug = (description: string, ...params: Array<unknown>) => __logPush(["(debug)", path, executeId, getNow(), `\n${description}`, ...params]);
    logger.info = (description: string, ...params: Array<unknown>) => __logPush(["(info)", path, executeId, getNow(), `\n${description}`, ...params]);
    logger.warn = (description: string, ...params: Array<unknown>) => __logPush(["(warn)", path, executeId, getNow(), `\n${description}`, ...params]);
    logger.error = (description: string, ...params: Array<unknown>) => __logPush(["(error)", path, executeId, getNow(), `\n${description}`, ...params]);
    logger.request = (description: string, ...params: Array<unknown>) => __logPush(["(request)", path, executeId, getNow(), `\n${description}`, ...params]);
    logger.response = (description: string, ...params: Array<unknown>) => __logPush(["(response)", path, executeId, getNow(), `\n${description}`, ...params]);

    return logger;
}
