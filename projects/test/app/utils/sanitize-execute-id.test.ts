import { expect, test } from "vite-plus/test";
import { sanitizeExecuteId } from "../../../../packages/milkio/utils/sanitize-execute-id.ts";

test("keeps alphanumeric, dash and underscore", () => {
    expect(sanitizeExecuteId("abc-123_XYZ")).toBe("abc-123_XYZ");
});

test("strips characters that would break JSON or logs", () => {
    expect(sanitizeExecuteId('a"b<c>d\ne,f')).toBe("abcdef");
});

test("empty and non-string inputs become empty string", () => {
    expect(sanitizeExecuteId("")).toBe("");
    expect(sanitizeExecuteId(undefined)).toBe("");
    expect(sanitizeExecuteId(123 as any)).toBe("");
});
