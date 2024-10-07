import { TSON } from "@southern-aurora/tson";
import { format } from "date-fns";
import { type MilkioInit, type MilkioRuntimeInit } from "..";

export type Log = [string /* executeId */, "[DEBUG]" | "[INFO]" | "[WARN]" | "[ERROR]", string, string, ...Array<unknown>];

export type Logger = {
  _: {
    logs: Array<Log>;
    tags: Map<string, unknown>;
  };
  setTag: (key: string, value: unknown) => void;
  setLog: (...log: Log) => void;
  debug: (description: string, ...params: Array<unknown>) => Log;
  info: (description: string, ...params: Array<unknown>) => Log;
  warn: (description: string, ...params: Array<unknown>) => Log;
  error: (description: string, ...params: Array<unknown>) => Log;
};

export const createLogger = <MilkioRuntime extends MilkioRuntimeInit<MilkioRuntimeInit<MilkioInit>> = MilkioRuntimeInit<MilkioInit>>(runtime: MilkioRuntime, executeId: string): Logger => {
  const logger = {} as Logger;

  logger._ = {
    logs: new Array(),
    tags: new Map(),
  };

  const __tagPush = (key: string, value: unknown): void => {
    logger._.tags.set(key, value);
  };
  const __logPush = (log: Log): Log => {
    logger._.logs.push([...log]);
    if (runtime.port.develop !== "disabled") {
      void (async () => {
        try {
          const response = await fetch(`http://localhost:${runtime.port.develop}/$action`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: TSON.stringify({
              type: "milkio@logger",
              log: log,
            }),
          });
          if (!response.ok) console.log("[COOKBOOK]", await response.text());
        } catch (error) {
          console.log("[COOKBOOK]", error);
        }
      })();
    }
    console.log(...log);
    return log;
  };

  logger.setTag = (key: string, value: unknown) => __tagPush(key, value);
  logger.setLog = (...log: Log) => __logPush(log);

  const getNow = () => format(new Date(), "(yyyy-MM-dd hh:mm:ss)");

  logger.debug = (description: string, ...params: Array<unknown>) => __logPush([executeId, "[DEBUG]", description, getNow(), ...params]);
  logger.info = (description: string, ...params: Array<unknown>) => __logPush([executeId, "[INFO]", description, getNow(), ...params]);
  logger.warn = (description: string, ...params: Array<unknown>) => __logPush([executeId, "[WARN]", description, getNow(), ...params]);
  logger.error = (description: string, ...params: Array<unknown>) => __logPush([executeId, "[ERROR]", description, getNow(), ...params]);

  return logger;
};
