import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { encodeCursor, serializeFilters } from "./cursor";
import { iterateDescending, matchesFilters } from "./reader";
import { createSession, getSessionDir, listSessions, resolveSessionSelection, setLogsRoot } from "./session";
import type { CursorState, LocatedLogRecord, LogFilters, LogRecord, SessionSummary } from "./types";

let root: string;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "cookbook-reader-"));
    setLogsRoot(root);
});

afterEach(() => {
    setLogsRoot(undefined);
    rmSync(root, { recursive: true, force: true });
});

function emptyFilters(): LogFilters {
    return { errorsOnly: false, search: [], readyOnly: false };
}

function record(ts: number, text: string, extra: Partial<LogRecord> = {}): LogRecord {
    return { ts, source: "worker:test", stream: "stdout", text, ...extra };
}

function segmentPath(sessionId: string, pid: number, seq: number): string {
    const dir = getSessionDir(sessionId);
    mkdirSync(dir, { recursive: true });
    return join(dir, `${pid}-${String(seq).padStart(6, "0")}.jsonl`);
}

interface SegmentOptions {
    /** Appended verbatim after the last newline (no trailing newline). */
    trailingPartial?: string;
    /** Insert one corrupt JSON line in the middle. */
    corrupt?: boolean;
}

function writeSegment(sessionId: string, pid: number, seq: number, records: LogRecord[], options: SegmentOptions = {}): string {
    const path = segmentPath(sessionId, pid, seq);
    const lines = records.map((item) => JSON.stringify(item));
    if (options.corrupt) lines.splice(Math.floor(lines.length / 2), 0, "{not valid json");
    let content = `${lines.join("\n")}\n`;
    if (options.trailingPartial !== undefined) content += options.trailingPartial;
    writeFileSync(path, content, "utf-8");
    return path;
}

function sessionsFor(ids: string[]): SessionSummary[] {
    const all = listSessions();
    return ids.map((id) => {
        const summary = all.find((item) => item.meta.sessionId === id);
        if (!summary) throw new Error(`missing fixture session ${id}`);
        return summary;
    });
}

function collect(ids: string[], filters: LogFilters = emptyFilters(), after?: CursorState) {
    const records: LocatedLogRecord[] = [];
    const result = iterateDescending({
        sessions: sessionsFor(ids),
        filters,
        after,
        onRecord: (item) => {
            records.push(item);
        },
    });
    return { records, result };
}

function cursorFrom(item: LocatedLogRecord, overrides: Partial<CursorState> = {}): CursorState {
    return {
        v: 1,
        sid: item.sessionId,
        sessionStartedAt: item.sessionStartedAt,
        ts: item.ts,
        pid: item.pid,
        seq: item.seq,
        line: item.line,
        page: 1,
        filters: serializeFilters(emptyFilters()),
        pageSize: 65536,
        ...overrides,
    };
}

describe("iterateDescending", () => {
    test("merges pids and segments in descending timestamp order", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        const base = meta.startedAt;
        writeSegment(meta.sessionId, 100, 1, [record(base + 10, "a1"), record(base + 30, "a3")]);
        writeSegment(meta.sessionId, 100, 2, [record(base + 50, "a5"), record(base + 70, "a7")]);
        writeSegment(meta.sessionId, 200, 1, [record(base + 20, "b2"), record(base + 40, "b4")]);
        writeSegment(meta.sessionId, 200, 2, [record(base + 60, "b6"), record(base + 80, "b8")]);

        const { records, result } = collect([meta.sessionId]);

        expect(records.map((item) => item.text)).toEqual(["b8", "a7", "b6", "a5", "b4", "a3", "b2", "a1"]);
        expect(result.recordsRead).toBe(8);
        expect(result.segmentsRead).toBe(4);
        expect(result.bytesRead).toBeGreaterThan(0);
        expect(records[0]).toMatchObject({ pid: 200, seq: 2 });
        expect(records[1]).toMatchObject({ pid: 100, seq: 2 });
        expect(records[7]).toMatchObject({ pid: 100, seq: 1 });
    });

    test("ignores a trailing partial line and skips corrupt JSON", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        const base = meta.startedAt;
        writeSegment(meta.sessionId, 7, 1, [record(base + 10, "first"), record(base + 30, "third")], {
            corrupt: true,
            trailingPartial: '{"ts":123,"source":"worker:test","stream":"stdout","text":"partial line',
        });

        const { records, result } = collect([meta.sessionId]);

        expect(records.map((item) => item.text)).toEqual(["third", "first"]);
        expect(result.recordsRead).toBe(2);
        expect(result.segmentsRead).toBe(1);
    });

    test("located line is the byte offset of the line start", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        const base = meta.startedAt;
        const firstLine = JSON.stringify(record(base + 10, "first"));
        const secondLine = JSON.stringify(record(base + 20, "second"));
        writeFileSync(segmentPath(meta.sessionId, 3, 1), `${firstLine}\n${secondLine}\n`, "utf-8");

        const { records } = collect([meta.sessionId]);

        expect(records.map((item) => item.text)).toEqual(["second", "first"]);
        expect(records[0].line).toBe(Buffer.byteLength(`${firstLine}\n`));
        expect(records[1].line).toBe(0);
    });

    test("--from early-stops after reading only the newest segment", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        const base = meta.startedAt;
        writeSegment(meta.sessionId, 1, 1, [record(base + 1, "one"), record(base + 2, "two")]);
        writeSegment(meta.sessionId, 1, 2, [record(base + 3, "three"), record(base + 4, "four")]);
        writeSegment(meta.sessionId, 1, 3, [record(base + 5, "five"), record(base + 6, "six")]);

        const { records, result } = collect([meta.sessionId], { ...emptyFilters(), from: base + 6 });

        expect(records.map((item) => item.text)).toEqual(["six"]);
        expect(result.segmentsRead).toBe(1);
        expect(result.recordsRead).toBe(2);
    });

    test("onRecord returning false stops the traversal early", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        const base = meta.startedAt;
        writeSegment(meta.sessionId, 1, 1, [record(base + 1, "one"), record(base + 2, "two")]);
        writeSegment(meta.sessionId, 1, 2, [record(base + 3, "three"), record(base + 4, "four")]);

        const seen: string[] = [];
        const result = iterateDescending({
            sessions: sessionsFor([meta.sessionId]),
            filters: emptyFilters(),
            onRecord: (item) => {
                seen.push(item.text);
                return false;
            },
        });

        expect(seen).toEqual(["four"]);
        expect(result.segmentsRead).toBe(1);
        expect(result.recordsRead).toBe(1);
        expect(result.stopped).toBe(true);
    });

    test("after-cursor continues strictly older without duplicates", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        const base = meta.startedAt;
        writeSegment(meta.sessionId, 1, 1, [record(base + 1, "one"), record(base + 2, "two"), record(base + 3, "three"), record(base + 4, "four")]);

        const all = collect([meta.sessionId]).records;
        const cursor = cursorFrom(all[1]!); // after "three"
        const { records } = collect([meta.sessionId], emptyFilters(), cursor);

        expect(records.map((item) => item.text)).toEqual(["two", "one"]);
        expect(records.some((item) => item.text === "four" || item.text === "three")).toBe(false);
    });

    test("all-session cursor continues within the same session and older sessions only", () => {
        const older = createSession({ sessionId: "1761063001123", mode: "test" });
        writeSegment(older.sessionId, 1, 1, [record(older.startedAt + 10, "o1"), record(older.startedAt + 20, "o2")]);
        const newer = createSession({ sessionId: "1761063005123", mode: "test" });
        writeSegment(newer.sessionId, 2, 1, [record(newer.startedAt + 10, "n1"), record(newer.startedAt + 20, "n2"), record(newer.startedAt + 30, "n3")]);

        const selection = resolveSessionSelection({ session: "all" });
        const all: LocatedLogRecord[] = [];
        iterateDescending({
            sessions: selection.sessions,
            filters: emptyFilters(),
            onRecord: (item) => {
                all.push(item);
            },
        });
        expect(all.map((item) => item.text)).toEqual(["n3", "n2", "n1", "o2", "o1"]);

        const cursor = cursorFrom(all[1]!, { sid: "all" }); // after "n2"
        const older_after: string[] = [];
        iterateDescending({
            sessions: selection.sessions,
            filters: emptyFilters(),
            after: cursor,
            onRecord: (item) => {
                older_after.push(item.text);
            },
        });

        expect(older_after).toEqual(["n1", "o2", "o1"]);
    });

    test("a missing/session-less directory is simply empty", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        const selection = resolveSessionSelection();
        rmSync(getSessionDir(meta.sessionId), { recursive: true, force: true });

        const records: LocatedLogRecord[] = [];
        const result = iterateDescending({
            sessions: selection.sessions,
            filters: emptyFilters(),
            onRecord: (item) => {
                records.push(item);
            },
        });

        expect(records).toEqual([]);
        expect(result.segmentsRead).toBe(0);
    });
});

describe("matchesFilters", () => {
    const base = (overrides: Partial<LocatedLogRecord> = {}): LocatedLogRecord => ({
        ts: 1000,
        source: "worker:test",
        stream: "stdout",
        text: "hello world",
        sessionId: "1761063001123",
        sessionStartedAt: 1761063001123,
        pid: 1,
        seq: 1,
        line: 0,
        ...overrides,
    });

    test("empty filters match everything", () => {
        expect(matchesFilters(base(), emptyFilters())).toBe(true);
    });

    test("error filtering uses stderr / err / text keywords", () => {
        expect(matchesFilters(base({ stream: "stderr" }), { ...emptyFilters(), errorsOnly: true })).toBe(true);
        expect(matchesFilters(base({ err: true, text: "wrote bytes" }), { ...emptyFilters(), errorsOnly: true })).toBe(true);
        expect(matchesFilters(base({ text: "request failed" }), { ...emptyFilters(), errorsOnly: true })).toBe(true);
        expect(matchesFilters(base(), { ...emptyFilters(), errorsOnly: true })).toBe(false);
    });

    test("readyOnly matches worker-ready* kinds and takes priority over errorsOnly", () => {
        const ready = base({ kind: "worker-ready", text: "ready in 10ms" });
        const failed = base({ kind: "worker-ready-failed", text: "worker exited" });
        expect(matchesFilters(ready, { ...emptyFilters(), readyOnly: true })).toBe(true);
        expect(matchesFilters(failed, { ...emptyFilters(), readyOnly: true })).toBe(true);
        expect(matchesFilters(base({ kind: "worker-ready" }), { ...emptyFilters(), readyOnly: true, errorsOnly: true })).toBe(true);
        expect(matchesFilters(base(), { ...emptyFilters(), readyOnly: true, errorsOnly: true })).toBe(false);
    });

    test("project matches worker source or meta.project", () => {
        expect(matchesFilters(base({ source: "worker:api" }), { ...emptyFilters(), project: "api" })).toBe(true);
        expect(matchesFilters(base({ source: "cookbook", meta: { project: "api" } }), { ...emptyFilters(), project: "api" })).toBe(true);
        expect(matchesFilters(base({ source: "worker:web" }), { ...emptyFilters(), project: "api" })).toBe(false);
    });

    test("search is case-insensitive AND", () => {
        expect(matchesFilters(base({ text: "Connection TIMEOUT while reading" }), { ...emptyFilters(), search: ["timeout"] })).toBe(true);
        expect(matchesFilters(base({ text: "Connection TIMEOUT while reading" }), { ...emptyFilters(), search: ["connection", "TIMEOUT"] })).toBe(true);
        expect(matchesFilters(base({ text: "Connection TIMEOUT while reading" }), { ...emptyFilters(), search: ["connection", "missing"] })).toBe(false);
    });

    test("from/to boundaries are inclusive", () => {
        const timed = base({ ts: 1000 });
        expect(matchesFilters(timed, { ...emptyFilters(), from: 1000 })).toBe(true);
        expect(matchesFilters(timed, { ...emptyFilters(), from: 1001 })).toBe(false);
        expect(matchesFilters(timed, { ...emptyFilters(), to: 1000 })).toBe(true);
        expect(matchesFilters(timed, { ...emptyFilters(), to: 999 })).toBe(false);
    });
});

describe("cursor encoding integration", () => {
    test("encodeCursor over a located record round-trips through the reader position", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        writeSegment(meta.sessionId, 4, 2, [record(meta.startedAt + 10, "newer"), record(meta.startedAt + 20, "newest")]);
        const all = collect([meta.sessionId]).records;
        const token = encodeCursor(cursorFrom(all[0]!));
        const decoded = JSON.parse(Buffer.from(token.slice(3), "base64url").toString("utf-8"));
        expect(decoded.line).toBe(all[0]!.line);
        expect(decoded.line).toBeGreaterThan(0);
    });
});
