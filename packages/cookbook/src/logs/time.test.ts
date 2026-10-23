import { describe, expect, test } from "vitest";
import { formatTimestamp, parsePageSize, parseTimeBoundary } from "./time";

function local(y: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): number {
    return new Date(y, month - 1, day, hour, minute, second, ms).getTime();
}

describe("parseTimeBoundary", () => {
    test("date only expands to start / end of day", () => {
        expect(parseTimeBoundary("2026-10-21", "from")).toBe(local(2026, 10, 21, 0, 0, 0, 0));
        expect(parseTimeBoundary("2026-10-21", "to")).toBe(local(2026, 10, 21, 23, 59, 59, 999));
    });

    test("minute precision", () => {
        expect(parseTimeBoundary("2026-10-21 00:10", "from")).toBe(local(2026, 10, 21, 0, 10, 0, 0));
        expect(parseTimeBoundary("2026-10-21 00:10", "to")).toBe(local(2026, 10, 21, 0, 10, 59, 999));
    });

    test("second precision", () => {
        expect(parseTimeBoundary("2026-10-21 00:10:30", "from")).toBe(local(2026, 10, 21, 0, 10, 30, 0));
        expect(parseTimeBoundary("2026-10-21 00:10:30", "to")).toBe(local(2026, 10, 21, 0, 10, 30, 999));
    });

    test("millisecond precision is exact", () => {
        expect(parseTimeBoundary("2026-10-21 00:10:30.123", "from")).toBe(local(2026, 10, 21, 0, 10, 30, 123));
        expect(parseTimeBoundary("2026-10-21 00:10:30.123", "to")).toBe(local(2026, 10, 21, 0, 10, 30, 123));
    });

    test("ISO 8601 with explicit zone", () => {
        expect(parseTimeBoundary("2026-10-21T00:10:30.123Z", "from")).toBe(Date.parse("2026-10-21T00:10:30.123Z"));
        expect(parseTimeBoundary("2026-10-21T08:10:30+08:00", "from")).toBe(Date.parse("2026-10-21T00:10:30Z"));
    });

    test("rejects invalid values", () => {
        expect(() => parseTimeBoundary("", "from")).toThrow();
        expect(() => parseTimeBoundary("2026-13-40", "to")).toThrow();
        expect(() => parseTimeBoundary("yesterday", "from")).toThrow();
        expect(() => parseTimeBoundary("2026-10-21 24:00:00", "from")).toThrow();
    });
});

describe("formatTimestamp", () => {
    test("local time with milliseconds", () => {
        expect(formatTimestamp(local(2026, 10, 21, 0, 10, 1, 23))).toBe("2026-10-21 00:10:01.023");
        expect(formatTimestamp(local(2026, 1, 2, 3, 4, 5, 6))).toBe("2026-01-02 03:04:05.006");
    });
});

describe("parsePageSize", () => {
    test("parses size units", () => {
        expect(parsePageSize("64kb")).toBe(65536);
        expect(parsePageSize("64KB")).toBe(65536);
        expect(parsePageSize("65536")).toBe(65536);
        expect(parsePageSize("65536b")).toBe(65536);
        expect(parsePageSize("1mb")).toBe(1048576);
    });

    test("rejects invalid sizes", () => {
        expect(() => parsePageSize("0")).toThrow();
        expect(() => parsePageSize("1gb")).toThrow();
        expect(() => parsePageSize("large")).toThrow();
    });
});
