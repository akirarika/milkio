import { format } from "date-fns";

export type Log = ["[DEBUG]" | "[INFO]" | "[WARN]" | "[ERROR]", string, string, ...Array<unknown>];

export type Logger = {
  _: {
    logs: Array<Log>;
    tags: Map<string, unknown>;
  };
  setTag: (key: string, value: unknown) => void;
  setLog: (...log: Log) => void;
  debug: (description: string, ...params: Array<unknown>) => void;
  log: (description: string, ...params: Array<unknown>) => void;
  info: (description: string, ...params: Array<unknown>) => void;
  warn: (description: string, ...params: Array<unknown>) => void;
  error: (description: string, ...params: Array<unknown>) => void;
};

export const createLogger = (executeId: string): Logger => {
  const logger = {} as Logger;

  logger._ = {
    logs: new Array(),
    tags: new Map(),
  };

  const __tagPush = (key: string, value: unknown): void => {
    logger._.tags.set(key, value);
  };
  const __logPush = (log: Log): void => {
    console.log(...log);
    logger._.logs.push(log);
  };

  logger.setTag = (key: string, value: unknown) => __tagPush(key, value);
  logger.setLog = (...log: Log) => __logPush(log);

  const getNow = () => format(new Date(), "(yyyy-MM-dd hh:mm:ss)");

  logger.debug = (description: string, ...params: Array<unknown>) => __logPush(["[DEBUG]", description, getNow(), ...params]);
  logger.info = (description: string, ...params: Array<unknown>) => __logPush(["[INFO]", description, getNow(), ...params]);
  logger.warn = (description: string, ...params: Array<unknown>) => __logPush(["[WARN]", description, getNow(), ...params]);
  logger.error = (description: string, ...params: Array<unknown>) => __logPush(["[ERROR]", description, getNow(), ...params]);

  return logger;
};
