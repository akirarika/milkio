import { describe, expect, test } from "vite-plus/test";
import { compareDesc, decodeCursor, deserializeFilters, encodeCursor, isRecordAfterCursor, serializeFilters } from "./cursor";
import type { CursorState, LocatedLogRecord } from "./types";

const filters = serializeFilters({ errorsOnly: true, search: ["timeout"], from: 1000, to: 2000, project: "test", readyOnly: false });

function cursor(overrides: Partial<CursorState> = {}): CursorState {
    return {
        v: 1,
        sid: "1761063001123",
        ts: 1000,
        pid: 42,
        seq: 1,
        line: 3,
        sessionStartedAt: 1761063001123,
        page: 2,
        filters,
        pageSize: 65536,
        ...overrides,
    };
}

function record(overrides: Partial<LocatedLogRecord> = {}): LocatedLogRecord {
    return {
        ts: 1000,
        source: "worker:test",
        stream: "stdout",
        text: "hello",
        sessionId: "1761063001123",
        sessionStartedAt: 1761063001123,
        pid: 42,
        seq: 1,
        line: 3,
        ...overrides,
    };
}

describe("cursor encoding", () => {
    test("round-trips state and filters", () => {
        const decoded = decodeCursor(encodeCursor(cursor()));
        expect(decoded).toEqual(cursor());
        expect(deserializeFilters(decoded.filters)).toEqual({ errorsOnly: true, search: ["timeout"], from: 1000, to: 2000, project: "test", readyOnly: false });
    });

    test("rejects invalid tokens", () => {
        expect(() => decodeCursor("nope")).toThrow();
        expect(() => decodeCursor("c1.not-base64")).toThrow();
        expect(() => decodeCursor(`c1.${Buffer.from("{}").toString("base64url")}`)).toThrow();
    });
});

describe("descending order", () => {
    test("compareDesc puts newer first and breaks ties deterministically", () => {
        const a = { ts: 1000, pid: 42, seq: 1, line: 3 };
        const b = { ts: 900, pid: 42, seq: 1, line: 1 };
        expect(compareDesc(a, b)).toBeLessThan(0);
        expect(compareDesc(b, a)).toBeGreaterThan(0);
        expect(compareDesc(a, a)).toBe(0);
        expect(compareDesc({ ts: 1000, pid: 43, seq: 1, line: 0 }, a)).toBeLessThan(0);
        expect(compareDesc({ ts: 1000, pid: 42, seq: 2, line: 0 }, a)).toBeLessThan(0);
        expect(compareDesc({ ts: 1000, pid: 42, seq: 1, line: 4 }, a)).toBeLessThan(0);
    });
});

describe("isRecordAfterCursor", () => {
    test("same session: strictly older records are after the cursor", () => {
        const c = cursor();
        expect(isRecordAfterCursor(record({ ts: 999 }), c)).toBe(true);
        expect(isRecordAfterCursor(record({ ts: 1001 }), c)).toBe(false);
        expect(isRecordAfterCursor(record(), c)).toBe(false);
        expect(isRecordAfterCursor(record({ pid: 41 }), c)).toBe(true);
        expect(isRecordAfterCursor(record({ line: 2 }), c)).toBe(true);
        expect(isRecordAfterCursor(record({ line: 4 }), c)).toBe(false);
    });

    test("all sessions: newer sessions are skipped, older ones included", () => {
        const c = cursor({ sid: "all" });
        expect(isRecordAfterCursor(record({ sessionStartedAt: 1761063002000, sessionId: "1761063002000" }), c)).toBe(false);
        expect(isRecordAfterCursor(record({ sessionStartedAt: 1761063000000, sessionId: "1761063000000" }), c)).toBe(true);
        expect(isRecordAfterCursor(record({ ts: 999 }), c)).toBe(true);
    });
});
