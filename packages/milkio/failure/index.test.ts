import { describe, expect, it } from "vite-plus/test";
import type { Logger } from "../index.ts";
import { fail, fault, failureHandler, isMilkioFailure, MilkioFaultError } from "./index.ts";

// Collect what failureHandler writes into the logger.
function createLogger() {
    const logs: Array<Array<unknown> & { level?: string }> = [];
    const push = (level: string) => (...args: Array<unknown>) => {
        const log = args as any;
        log.level = level;
        logs.push(log);
        return log;
    };
    const logger = {
        error: push("error"),
        warn: push("warn"),
        info: push("info"),
        debug: push("debug"),
        request: push("request"),
        response: push("response"),
    } as unknown as Logger;
    return { logger, logs };
}

describe("failureHandler: fail-code (business, warn)", () => {
    it("logs one warn, never a stack, and exposes code + data on the wire", () => {
        const { logger, logs } = createLogger();
        const result = failureHandler("exec-1", logger, fail("POINT_INSUFFICIENT", { required: 100, available: 50 }));

        expect(logs.length).toBe(1);
        expect(logs[0]!.level).toBe("warn");
        expect(JSON.stringify(logs)).not.toContain("at ");
        expect(result.response).toEqual({
            success: false,
            executeId: "exec-1",
            error: { kind: "fail", code: "POINT_INSUFFICIENT", data: { required: 100, available: 50 } },
        });
    });

    it("does not create an Error / capture a stack for fail", () => {
        const error = fail("DATA_NOT_FOUND");
        expect(error).not.toBeInstanceOf(Error);
        expect("stack" in error).toBe(false);
        expect(Object.keys(error).sort()).toEqual(["$milkioFailure", "code", "data", "kind"]);
    });
});

describe("failureHandler: fault-code (internal, error)", () => {
    it("logs real code/data/stack/cause but hides everything from the client", () => {
        const { logger, logs } = createLogger();
        const cause = Object.assign(new Error("Table 'space' doesn't exist"), { code: "ER_NO_SUCH_TABLE", errno: 1146 });
        const error = fault("POINT_LEDGER_INVARIANT_BROKEN", { ledgerId: "l1" }, { cause });

        expect(error).toBeInstanceOf(Error);
        const result = failureHandler("exec-2", logger, error);

        expect(logs.length).toBe(1);
        expect(logs[0]!.level).toBe("error");
        const output = JSON.stringify(logs);
        expect(output).toContain("POINT_LEDGER_INVARIANT_BROKEN");
        expect(output).toContain("l1");
        expect(output).toContain("causes:");
        expect(output).toContain("ER_NO_SUCH_TABLE");

        expect(result.response).toEqual({ success: false, executeId: "exec-2", error: { kind: "fault", code: "INTERNAL_SERVER_ERROR" } });
        expect(JSON.stringify(result.response)).not.toContain("POINT_LEDGER_INVARIANT_BROKEN");
        expect(JSON.stringify(result.response)).not.toContain("ER_NO_SUCH_TABLE");
        expect(result.report?.code).toBe("POINT_LEDGER_INVARIANT_BROKEN");
    });

    it("wraps unexpected errors as INTERNAL_SERVER_ERROR and keeps the cause chain", () => {
        const { logger, logs } = createLogger();
        const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:3306"), { code: "ECONNREFUSED" });
        const error = new Error("Failed query: select 1", { cause });
        const result = failureHandler("exec-3", logger, error);

        expect(result.report?.source).toBe("unexpected");
        expect(result.report?.code).toBe("INTERNAL_SERVER_ERROR");
        expect(JSON.stringify(logs)).toContain("ECONNREFUSED");
        expect(result.response.error).toEqual({ kind: "fault", code: "INTERNAL_SERVER_ERROR" });
    });

    it("treats non-Error throws as faults", () => {
        const { logger } = createLogger();
        const result = failureHandler("exec-4", logger, "boom");
        expect(result.response.error).toEqual({ kind: "fault", code: "INTERNAL_SERVER_ERROR" });
    });

    it("does not hang on a circular cause chain", () => {
        const { logger, logs } = createLogger();
        const error: any = new Error("outer");
        const cause: any = new Error("inner");
        error.cause = cause;
        cause.cause = error;
        failureHandler("exec-5", logger, error);
        expect(JSON.stringify(logs)).toContain("causes:");
    });
});

describe("failureHandler: hooks", () => {
    it("calls onError only for fault, and swallows its own errors", () => {
        let calls = 0;
        const onError = () => {
            calls++;
            throw new Error("alerting is down");
        };
        const { logger } = createLogger();

        failureHandler("e1", logger, fail("DATA_NOT_FOUND"), { onError });
        expect(calls).toBe(0);

        const faultResult = failureHandler("e2", logger, new MilkioFaultError("FRAMEWORK_ERROR", { message: "x" }), { onError });
        expect(calls).toBe(1);
        expect(faultResult.response.success).toBe(false);
    });
});

describe("failure markers", () => {
    it("recognizes fail and fault objects across JSON round-trips", () => {
        expect(isMilkioFailure(fail("DATA_NOT_FOUND"))).toBe(true);
        expect(isMilkioFailure(fault("INTERNAL_SERVER_ERROR"))).toBe(true);
        expect(isMilkioFailure(new Error("x"))).toBe(false);

        const revived = JSON.parse(JSON.stringify({ $milkioFailure: true, kind: "fail", code: "DATA_NOT_FOUND", data: undefined }));
        expect(isMilkioFailure(revived)).toBe(true);
    });
});
