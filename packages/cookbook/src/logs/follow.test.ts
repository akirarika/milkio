import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { followSession, type FollowHandle, type FollowOptions } from "./follow";
import { createSession, finalizeSession, getSessionDir, resolveSessionSelection, setLogsRoot } from "./session";
import type { LogFilters, LogRecord, SessionSummary } from "./types";

let root: string;
let meta: ReturnType<typeof createSession>;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "cookbook-follow-"));
    setLogsRoot(root);
    meta = createSession({ sessionId: "1761063001123", mode: "test" });
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

function segmentPath(pid: number, seq: number): string {
    const dir = getSessionDir(meta.sessionId);
    mkdirSync(dir, { recursive: true });
    return join(dir, `${pid}-${String(seq).padStart(6, "0")}.jsonl`);
}

function writeSegment(pid: number, seq: number, records: LogRecord[]): string {
    const path = segmentPath(pid, seq);
    writeFileSync(path, `${records.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf-8");
    return path;
}

function appendRecords(path: string, records: LogRecord[]): void {
    appendFileSync(path, `${records.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf-8");
}

function currentSummary(): SessionSummary {
    return resolveSessionSelection().sessions[0]!;
}

interface FollowFixture {
    handle: FollowHandle;
    writes: string[];
    exits: number[];
    output: () => string;
}

function startFollow(overrides: Partial<FollowOptions> = {}): FollowFixture {
    const writes: string[] = [];
    const exits: number[] = [];
    const options: FollowOptions = {
        session: currentSummary(),
        filters: emptyFilters(),
        color: false,
        write: (text) => writes.push(text),
        isTTY: true,
        autoTick: false,
        exit: (code) => exits.push(code),
        ...overrides,
    };
    const handle = followSession(options);
    return { handle, writes, exits, output: () => writes.join("") };
}

function lineTexts(lines: string[]): string[] {
    return lines
        .map((line) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}  \[[^\]]*\]  stdout  (.*)$/.exec(line))
        .filter((match): match is RegExpExecArray => match !== null)
        .map((match) => match[1]!);
}

describe("followSession", () => {
    test("requires an interactive terminal", () => {
        expect(() => startFollow({ isTTY: false })).toThrow(/interactive terminal/);
    });

    test("seeds the newest page and prepends newly appended records without duplicates", () => {
        const base = meta.startedAt;
        const path = writeSegment(1, 1, [record(base + 1, "one"), record(base + 2, "two"), record(base + 3, "three")]);
        const fixture = startFollow();

        expect(lineTexts(fixture.handle.lines())).toEqual(["three", "two", "one"]);
        expect(fixture.writes[0]).toBe("\x1b[?25l");
        expect(fixture.writes[1]!.startsWith("\x1b[H\x1b[2J")).toBe(true);
        expect(fixture.output()).toContain("LIVE · newest first · Ctrl+C to exit");

        appendRecords(path, [record(base + 10, "four"), record(base + 11, "five")]);
        fixture.handle.tick();
        expect(lineTexts(fixture.handle.lines())).toEqual(["five", "four", "three", "two", "one"]);

        fixture.handle.tick();
        expect(lineTexts(fixture.handle.lines())).toEqual(["five", "four", "three", "two", "one"]);

        fixture.handle.stop();
    });

    test("bounded deque keeps the newest whole lines within the byte budget", () => {
        const base = meta.startedAt;
        const path = writeSegment(1, 1, [record(base + 1, "record-1"), record(base + 2, "record-2"), record(base + 3, "record-3")]);
        const fixture = startFollow({ pageSize: 140 });

        expect(lineTexts(fixture.handle.lines())).toEqual(["record-3", "record-2"]);
        for (const line of fixture.handle.lines()) expect(line).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}  \[test\]  stdout  record-\d$/);

        appendRecords(path, [record(base + 4, "record-4")]);
        fixture.handle.tick();
        expect(lineTexts(fixture.handle.lines())).toEqual(["record-4", "record-3"]);

        fixture.handle.stop();
    });

    test("buffers a partial line until its newline arrives", () => {
        const base = meta.startedAt;
        const path = writeSegment(1, 1, [record(base + 1, "first")]);
        const fixture = startFollow();
        expect(lineTexts(fixture.handle.lines())).toEqual(["first"]);

        const line = JSON.stringify(record(base + 2, "second"));
        appendFileSync(path, line.slice(0, 12), "utf-8");
        fixture.handle.tick();
        expect(lineTexts(fixture.handle.lines())).toEqual(["first"]);

        appendFileSync(path, `${line.slice(12)}\n`, "utf-8");
        fixture.handle.tick();
        expect(lineTexts(fixture.handle.lines())).toEqual(["second", "first"]);

        fixture.handle.tick();
        expect(lineTexts(fixture.handle.lines())).toEqual(["second", "first"]);

        fixture.handle.stop();
    });

    test("applies filters to seeded and appended records", () => {
        const base = meta.startedAt;
        const path = writeSegment(1, 1, [record(base + 1, "keep-1"), record(base + 2, "drop-1"), record(base + 3, "keep-2")]);
        const fixture = startFollow({ filters: { ...emptyFilters(), search: ["keep"] } });

        expect(lineTexts(fixture.handle.lines())).toEqual(["keep-2", "keep-1"]);

        appendRecords(path, [record(base + 4, "drop-2"), record(base + 5, "keep-3")]);
        fixture.handle.tick();
        expect(lineTexts(fixture.handle.lines())).toEqual(["keep-3", "keep-2", "keep-1"]);

        fixture.handle.stop();
    });

    test("Ctrl+C restores the cursor and exits with code 130", () => {
        const base = meta.startedAt;
        writeSegment(1, 1, [record(base + 1, "one")]);
        const fixture = startFollow();

        fixture.handle.interrupt();

        expect(fixture.exits).toEqual([130]);
        expect(fixture.output()).toContain("\x1b[?25h");
        expect(fixture.output()).toContain("\x1b[?25l");
    });

    test("session end redraws, prints a message and exits with code 0", () => {
        const base = meta.startedAt;
        writeSegment(1, 1, [record(base + 1, "one")]);
        const fixture = startFollow();

        finalizeSession(meta.sessionId, "ended");
        fixture.handle.tick();

        expect(fixture.exits).toEqual([0]);
        expect(fixture.output()).toContain("Session ended. Live follow stopped.");
        expect(fixture.output()).toContain("\x1b[?25h");

        fixture.handle.tick();
        expect(fixture.exits).toEqual([0]);
    });

    test("merges appended records from multiple writer pids", () => {
        const base = meta.startedAt;
        const first = writeSegment(1, 1, [record(base + 1, "pid-1-old")]);
        const second = writeSegment(2, 1, [record(base + 2, "pid-2-old")]);
        const fixture = startFollow();
        expect(lineTexts(fixture.handle.lines())).toEqual(["pid-2-old", "pid-1-old"]);

        appendRecords(first, [record(base + 3, "pid-1-new")]);
        appendRecords(second, [record(base + 4, "pid-2-new")]);
        fixture.handle.tick();

        expect(lineTexts(fixture.handle.lines())).toEqual(["pid-2-new", "pid-1-new", "pid-2-old", "pid-1-old"]);
        fixture.handle.stop();
    });
});
