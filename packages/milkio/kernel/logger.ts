import { ExecuteResultFail, runtime, type ExecuteId } from "..";
import { loggerOptions, LoggerTags } from "../../../src/logger";

export type LoggerItem = {
	executeId: ExecuteId;
	loggerLevel: LoggerLevel;
	description: string;
	params: Array<unknown>;
};

export type MilkioLoggerTags = {
	executeId: string;
	from?: "http-server" | "execute";
	method?: "POST" | "GET" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | string;
	ip?: string;
	path?: string;
	status?: number;
	url?: string;
	params?: any;
	body?: string;
	fail?: ExecuteResultFail;
	timein?: number;
	timeout?: number;
	result?: unknown;
	requestHeaders?: Record<string, string>;
	responseHeaders?: Record<string, string>;
};

export type LoggerOptions = {
	onInsert: (options: LoggerItem) => boolean;
	onSubmit: (tags: MilkioLoggerTags & LoggerTags, logs: Array<LoggerItem>) => Promise<void> | void;
};

export type Logger = {
	debug: (description: string, ...params: Array<unknown>) => void;
	log: (description: string, ...params: Array<unknown>) => void;
	info: (description: string, ...params: Array<unknown>) => void;
	warn: (description: string, ...params: Array<unknown>) => void;
	error: (description: string, ...params: Array<unknown>) => void;
};

export const loggerController = (() => {
	const logs = new Map<ExecuteId, { __LOG_DETAIL__: Array<LoggerItem>; [key: string]: any }>();

	const loggerPushTags = (executeId: ExecuteId, tags: Partial<MilkioLoggerTags & LoggerTags>) => {
		if (!logs.has(executeId)) logs.set(executeId, { __LOG_DETAIL__: [] });
		const logItem = logs.get(executeId);
		for (const key in tags) {
			logItem![key] = (tags as any)[key];
		}
	};

	const loggerSubmit = async (executeId: ExecuteId) => {
		if (!logs.has(executeId)) return;
		if (executeId === "global") return;
		const loggerSubmitOptions: any = {
			executeId,
		};
		const log = logs.get(executeId)!;
		for (const key in log) {
			if (key === "__LOG_DETAIL__") continue;
			loggerSubmitOptions[key] = log[key];
		}
		logs.delete(executeId);
		loggerOptions.onSubmit(loggerSubmitOptions, log.__LOG_DETAIL__);
	};

	const loggerSubmitAll = async () => {
		for (const executeId of logs.keys()) {
			await loggerSubmit(executeId);
		}
	};

	const insertItem = (executeId: ExecuteId, level: LoggerLevel, description: string, params: Array<unknown>): void => {
		let executeIds: Array<string> = [];
		if (executeId === "global") {
			executeIds = Array.from(new Set([...Array.from(runtime.execute.executeIds), ...Array.from(runtime.execute.executeIds)]));
		} else {
			executeIds = [executeId];
		}

		for (const executeId of executeIds) {
			if (!logs.has(executeId as ExecuteId)) logs.set(executeId as ExecuteId, { __LOG_DETAIL__: [] });
			const loggerItem = {
				executeId: executeId as ExecuteId,
				loggerLevel: level,
				description,
				params,
			} satisfies LoggerItem;
			if (!loggerOptions.onInsert(loggerItem)) return;
			logs.get(executeId as ExecuteId)!.__LOG_DETAIL__.push(loggerItem);
		}
	};

	const useLogger = (executeId: ExecuteId) => {
		return {
			debug(description: string, ...params: Array<unknown>) {
				insertItem(executeId, "debug", description, params);
			},
			log(description: string, ...params: Array<unknown>) {
				insertItem(executeId, "log", description, params);
			},
			info(description: string, ...params: Array<unknown>) {
				insertItem(executeId, "log", description, params);
			},
			warn(description: string, ...params: Array<unknown>) {
				insertItem(executeId, "warn", description, params);
			},
			error(description: string, ...params: Array<unknown>) {
				insertItem(executeId, "error", description, params);
			},
		} satisfies Logger;
	};

	return {
		loggerPushTags,
		loggerSubmit,
		loggerSubmitAll,
		useLogger,
	};
})();

export const useLogger = loggerController.useLogger;

export const loggerPushTags = loggerController.loggerPushTags;

export const loggerSubmit = loggerController.loggerSubmit;

export const loggerSubmitAll = loggerController.loggerSubmitAll;

export type LoggerLevel = "debug" | "log" | "warn" | "error";
