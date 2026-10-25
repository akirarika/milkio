import { describe, expect, test } from "vite-plus/test";
import { isErrorRecord, isErrorText } from "./error-keywords";

describe("isErrorText", () => {
    test.each([
        "Error: connect ECONNREFUSED",
        "ERROR",
        "error",
        "an error happened",
        "no error",
        "[error]",
        "error:",
        "TypeError: x is not a function",
        "ReferenceError",
        "ERROR_CODE=500",
        "readFile failed",
        "failed to compile",
        "Failure",
        "failures",
        "fails",
        "failing",
        "error-prone",
        "something failed.",
        "写入失败，发生错误",
        "网络异常",
        "错误",
        "异常",
        "日志Error",
    ])("detects %j", (text) => {
        expect(isErrorText(text)).toBe(true);
    });

    test.each(["", "terror", "failover", "failsafe", "debug", "everything is fine", "非常"])("does not detect %j", (text) => {
        expect(isErrorText(text)).toBe(false);
    });

    test("camelCase components are scanned", () => {
        expect(isErrorText("failureHandler is ok?")).toBe(true);
        expect(isErrorText("unhandledRejectionError")).toBe(true);
    });
});

describe("isErrorRecord", () => {
    test("stderr is always an error", () => {
        expect(isErrorRecord({ stream: "stderr", text: "all good" })).toBe(true);
    });

    test("uses the precomputed err flag when present", () => {
        expect(isErrorRecord({ stream: "stdout", text: "all good", err: true })).toBe(true);
        expect(isErrorRecord({ stream: "stdout", text: "Error: x", err: false })).toBe(false);
    });

    test("falls back to scanning the text", () => {
        expect(isErrorRecord({ stream: "stdout", text: "Error: x" })).toBe(true);
        expect(isErrorRecord({ stream: "system", text: "worker started" })).toBe(false);
    });
});
