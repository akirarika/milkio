import { describe, expect, it } from "vitest";
import type { Logger } from "../index.ts";
import { exceptionHandler } from "./index.ts";

// 收集 exceptionHandler 写入日志的参数，断言 cause 链是否被序列化进错误日志
function createLogger() {
    const logs: Array<Array<unknown>> = [];
    const logger = {
        error: (...args: Array<unknown>) => {
            logs.push(args);
            return args as any;
        },
        warn: (...args: Array<unknown>) => {
            logs.push(args);
            return args as any;
        },
        info: (...args: Array<unknown>) => {
            logs.push(args);
            return args as any;
        },
        debug: () => [] as any,
        request: () => [] as any,
        response: () => [] as any,
    } as unknown as Logger;
    return { logger, logs };
}

describe("exceptionHandler 的错误日志", () => {
    it("把 cause 的 code / message 写入日志", () => {
        const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:3306"), { code: "ECONNREFUSED", errno: -111 });
        const error = new Error("Failed query: select 1", { cause });
        const { logger, logs } = createLogger();

        exceptionHandler("test-execute-id", logger, error);

        const output = JSON.stringify(logs);
        expect(output).toContain("causes:");
        expect(output).toContain("ECONNREFUSED");
        expect(output).toContain("127.0.0.1:3306");
    });

    it("多层 cause 链全部序列化", () => {
        const root = Object.assign(new Error("Table 'kecream_server.space' doesn't exist"), {
            code: "ER_NO_SUCH_TABLE",
            errno: 1146,
            sqlState: "42S02",
            sqlMessage: "Table 'kecream_server.space' doesn't exist",
        });
        const middle = new Error("driver failed", { cause: root });
        const error = new Error("Failed query: select * from space", { cause: middle });
        const { logger, logs } = createLogger();

        exceptionHandler("test-execute-id", logger, error);

        const output = JSON.stringify(logs);
        expect(output).toContain("driver failed");
        expect(output).toContain("ER_NO_SUCH_TABLE");
        expect(output).toContain("42S02");
    });

    it("没有 cause 时保持原有日志结构", () => {
        const error = new Error("boom");
        const { logger, logs } = createLogger();

        exceptionHandler("test-execute-id", logger, error);

        const output = JSON.stringify(logs);
        expect(output).not.toContain("causes:");
        expect(output).toContain("boom");
    });

    it("循环 cause 不会死循环", () => {
        const error: any = new Error("outer");
        const cause: any = new Error("inner");
        error.cause = cause;
        cause.cause = error;
        const { logger, logs } = createLogger();

        exceptionHandler("test-execute-id", logger, error);

        expect(JSON.stringify(logs)).toContain("causes:");
    });
});
