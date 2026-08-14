import { expect, test } from "vitest";
import { sanitizeExecuteId } from "../../../../packages/milkio/utils/sanitize-execute-id.ts";

test.sequential("keeps alphanumeric, dash and underscore", () => {
    expect(sanitizeExecuteId("abc-123_XYZ")).toBe("abc-123_XYZ");
});

test.sequential("strips characters that would break JSON or logs", () => {
    expect(sanitizeExecuteId('a"b<c>d\ne,f')).toBe("abcdef");
});

test.sequential("empty and non-string inputs become empty string", () => {
    expect(sanitizeExecuteId("")).toBe("");
    expect(sanitizeExecuteId(undefined)).toBe("");
    expect(sanitizeExecuteId(123 as any)).toBe("");
});
