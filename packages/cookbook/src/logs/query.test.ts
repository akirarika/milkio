import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { decodeCursor, serializeFilters } from "./cursor";
import { iterateDescending } from "./reader";
import { renderPage, type RenderPageOptions, type RenderPageResult } from "./query";
import { createSession, getSessionDir, resolveSessionSelection, setLogsRoot, type SessionSelection } from "./session";
import type { CursorState, LogFilters, LogRecord } from "./types";

let root: string;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "cookbook-query-"));
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

function writeSegment(sessionId: string, pid: number, seq: number, records: LogRecord[]): string {
    const dir = getSessionDir(sessionId);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${pid}-${String(seq).padStart(6, "0")}.jsonl`);
    writeFileSync(path, `${records.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf-8");
    return path;
}

interface RenderOptions {
    selection: SessionSelection;
    filters: LogFilters;
    after?: CursorState;
    pageSize?: number;
    count?: boolean;
}

function render(options: RenderOptions): { result: RenderPageResult; output: string; writes: string[] } {
    const writes: string[] = [];
    const pageOptions: RenderPageOptions = {
        selection: options.selection,
        filters: options.filters,
        after: options.after,
        pageSize: options.pageSize ?? 65536,
        count: options.count ?? false,
        write: (text) => writes.push(text),
        color: false,
    };
    const result = renderPage(pageOptions);
    return { result, output: writes.join(""), writes };
}

/** Extract the rendered log text column from page output, newest first. */
function logTexts(output: string): string[] {
    const texts: string[] = [];
    for (const line of output.split("\n")) {
        const match = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\s+(?:#\d+\s+)?\[[^\]]*\]\s+stdout\s+(.*)$/.exec(line);
        if (match) texts.push(match[1]!);
    }
    return texts;
}

function cursorFor(item: { ts: number; pid: number; seq: number; line: number }, sid: string, sessionStartedAt: number): CursorState {
    return {
        v: 1,
        sid,
        sessionStartedAt,
        ts: item.ts,
        pid: item.pid,
        seq: item.seq,
        line: item.line,
        page: 1,
        filters: serializeFilters(emptyFilters()),
        pageSize: 65536,
    };
}

describe("renderPage pagination", () => {
    test("page 1 is newest first and cursors continue without overlap until END OF LOGS", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        const base = meta.startedAt;
        writeSegment(meta.sessionId, 1, 1, [record(base + 1, "line-1"), record(base + 2, "line-2"), record(base + 3, "line-3")]);
        writeSegment(meta.sessionId, 1, 2, [record(base + 4, "line-4"), record(base + 5, "line-5"), record(base + 6, "line-6")]);
        const selection = resolveSessionSelection();

        const page1 = render({ selection, filters: emptyFilters(), pageSize: 160 });
        expect(page1.result).toMatchObject({ page: 1, printed: 2, matching: 3, hasOlder: true });
        expect(logTexts(page1.output)).toEqual(["line-6", "line-5"]);
        expect(page1.result.nextCursor).toBeDefined();
        expect(page1.output).toContain("page 1");
        expect(page1.output).toContain("MORE LOGS AVAILABLE — OLDER ENTRIES CONTINUE ON PAGE 2  (newest first)");
        expect(page1.output).toContain("co logs --cursor=");

        const decoded = decodeCursor(page1.result.nextCursor!);
        expect(decoded.sid).toBe(meta.sessionId);
        expect(decoded.page).toBe(1);
        expect(decoded.pageSize).toBe(160);
        expect(decoded.filters).toMatchObject({ e: 0, q: [], r: 0 });

        const page2 = render({ selection, filters: emptyFilters(), after: decoded, pageSize: 160 });
        expect(page2.result).toMatchObject({ page: 2, printed: 2, hasOlder: true });
        expect(logTexts(page2.output)).toEqual(["line-4", "line-3"]);

        const page3 = render({ selection, filters: emptyFilters(), after: decodeCursor(page2.result.nextCursor!), pageSize: 160 });
        expect(page3.result).toMatchObject({ page: 3, printed: 2, hasOlder: false });
        expect(logTexts(page3.output)).toEqual(["line-2", "line-1"]);
        expect(page3.result.nextCursor).toBeUndefined();
        expect(page3.output).toContain("END OF LOGS  (newest first)");
        expect(page3.output).toContain("co logs");
    });

    test("lines are never split, even when a single line exceeds the page size", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        const base = meta.startedAt;
        const huge = "X".repeat(2000);
        writeSegment(meta.sessionId, 1, 1, [record(base + 1, "small-1"), record(base + 2, "small-2"), record(base + 3, huge)]);
        const selection = resolveSessionSelection();

        const { result, output } = render({ selection, filters: emptyFilters(), pageSize: 300 });

        expect(result).toMatchObject({ page: 1, printed: 1, hasOlder: true });
        expect(output).toContain(huge);
        expect(logTexts(output)).toEqual([huge]);
    });

    test("--count scans for totals and adds matches to the header", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        const base = meta.startedAt;
        writeSegment(meta.sessionId, 1, 1, Array.from({ length: 6 }, (_, index) => record(base + index + 1, `line-${index + 1}`)));
        const selection = resolveSessionSelection();

        const paged = render({ selection, filters: emptyFilters(), pageSize: 160, count: true });
        expect(paged.result).toMatchObject({ page: 1, printed: 2, matching: 6, totalMatches: 6, hasOlder: true });
        expect(paged.output).toContain("6 matches");

        const single = render({ selection, filters: emptyFilters(), pageSize: 65536, count: true });
        expect(single.result).toMatchObject({ printed: 6, matching: 6, totalMatches: 6, hasOlder: false });
        expect(logTexts(single.output)).toEqual(["line-6", "line-5", "line-4", "line-3", "line-2", "line-1"]);
    });

    test("footer and next-page commands carry every filter with quoting", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        const base = meta.startedAt;
        writeSegment(
            meta.sessionId,
            1,
            1,
            Array.from({ length: 6 }, (_, index) =>
                record(base + index + 1, `timeout a b payload ${index + 1}`, { stream: "stderr", meta: { project: "my project" } }),
            ),
        );
        const filters: LogFilters = {
            errorsOnly: true,
            search: ["timeout", "a b"],
            from: base,
            to: base + 60_000,
            project: "my project",
            readyOnly: false,
        };
        const selection = resolveSessionSelection();

        const { result, output } = render({ selection, filters, pageSize: 160 });

        expect(result.hasOlder).toBe(true);
        expect(output).toContain("To view older logs, run:");
        expect(output).toContain("co logs --cursor=");
        expect(output).toContain("To return to the newest logs, run:");
        expect(output).toContain('co logs --errors --project="my project" --search=timeout --search="a b" --from="');
        expect(output).toContain('--to="');
        expect(output).not.toContain("--session=");
    });

    test("empty result prints a friendly message with the filter summary", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        writeSegment(meta.sessionId, 1, 1, [record(meta.startedAt + 1, "hello")]);
        const selection = resolveSessionSelection();
        const filters = { ...emptyFilters(), search: ["definitely-missing"] };

        const { result, output } = render({ selection, filters });

        expect(result).toMatchObject({ page: 1, printed: 0, matching: 0, hasOlder: false });
        expect(output).toContain("No matching log lines.");
        expect(output).toContain("--search=definitely-missing");
        expect(output).not.toContain("MORE LOGS AVAILABLE");
    });

    test("a cursor that yields no records prints No older logs. plus the newest command", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        const item = record(meta.startedAt + 1, "only-one");
        writeSegment(meta.sessionId, 1, 1, [item]);
        const selection = resolveSessionSelection();

        const located: Array<{ ts: number; pid: number; seq: number; line: number }> = [];
        iterateDescending({
            sessions: selection.sessions,
            filters: emptyFilters(),
            onRecord: (entry) => {
                located.push(entry);
            },
        });
        const cursor = cursorFor(located[0]!, meta.sessionId, meta.startedAt);

        const { result, output } = render({ selection, filters: emptyFilters(), after: cursor });

        expect(result).toMatchObject({ page: 2, printed: 0, matching: 0, hasOlder: false });
        expect(output).toContain("No older logs.");
        expect(output).toContain("To return to the newest logs, run:");
        expect(output).toContain("co logs");
    });

    test("--session all adds run tags and lists all sessions in the header", () => {
        const older = createSession({ sessionId: "1761063001123", mode: "test" });
        writeSegment(older.sessionId, 1, 1, [record(older.startedAt + 10, "old-1")]);
        const newer = createSession({ sessionId: "1761063005123", mode: "test" });
        writeSegment(newer.sessionId, 2, 1, [record(newer.startedAt + 10, "new-1"), record(newer.startedAt + 20, "new-2")]);
        const selection = resolveSessionSelection({ session: "all" });

        const { output } = render({ selection, filters: emptyFilters() });

        expect(output).toContain("All sessions (2)");
        expect(logTexts(output)).toEqual(["new-2", "new-1", "old-1"]);
        const logLines = output.split("\n").filter((line) => /^\d{4}-\d{2}-\d{2} /.test(line));
        expect(logLines[0]).toContain("#1");
        expect(logLines[2]).toContain("#2");
    });

    test("cursor continuation for --session all keeps session tags and advances", () => {
        const older = createSession({ sessionId: "1761063001123", mode: "test" });
        writeSegment(older.sessionId, 1, 1, [record(older.startedAt + 10, "old-1"), record(older.startedAt + 20, "old-2")]);
        const newer = createSession({ sessionId: "1761063005123", mode: "test" });
        writeSegment(newer.sessionId, 2, 1, [record(newer.startedAt + 10, "new-1"), record(newer.startedAt + 20, "new-2")]);
        const selection = resolveSessionSelection({ session: "all" });

        const page1 = render({ selection, filters: emptyFilters(), pageSize: 160 });
        expect(logTexts(page1.output)).toEqual(["new-2", "new-1"]);
        const cursor = decodeCursor(page1.result.nextCursor!);
        expect(cursor.sid).toBe("all");

        const page2 = render({ selection, filters: emptyFilters(), after: cursor, pageSize: 160 });
        expect(logTexts(page2.output)).toEqual(["old-2", "old-1"]);
        expect(page2.output.split("\n").find((line) => /^\d{4}-\d{2}-\d{2} /.test(line))).toContain("#2");
        expect(page2.result.hasOlder).toBe(false);
        expect(page2.output).toContain("END OF LOGS");
    });

    test("writes lines incrementally instead of buffering a whole page", () => {
        const meta = createSession({ sessionId: "1761063001123", mode: "test" });
        const base = meta.startedAt;
        writeSegment(meta.sessionId, 1, 1, Array.from({ length: 4 }, (_, index) => record(base + index + 1, `line-${index + 1}`)));
        const selection = resolveSessionSelection();

        const { writes, output } = render({ selection, filters: emptyFilters(), pageSize: 160 });

        // header, one write per line, footer, more-block separator
        expect(writes.length).toBeGreaterThan(4);
        expect(writes[0]).toContain("newest first");
        expect(writes[1]!.startsWith("20") || /^\d{4}-\d{2}-\d{2} /.test(writes[1]!)).toBe(true);
        expect(output).toContain("Page 1 · 2 lines");
    });
});
