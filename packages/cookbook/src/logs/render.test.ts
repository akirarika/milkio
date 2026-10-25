import { describe, expect, test } from "vite-plus/test";
import {
    buildNewestCommand,
    formatBytes,
    formatFilterSummary,
    formatSource,
    renderEmptyPage,
    renderEndOfLogsBlock,
    renderFooter,
    renderHeader,
    renderLogLine,
    renderMoreLogsBlock,
    renderSessionsList,
    type RetentionUsage,
} from "./render";
import type { LocatedLogRecord, LogFilters, SessionSummary } from "./types";

const startedAt = new Date(2026, 9, 21, 0, 10, 1, 23).getTime();

function emptyFilters(): LogFilters {
    return { errorsOnly: false, search: [], readyOnly: false };
}

function record(overrides: Partial<LocatedLogRecord> = {}): LocatedLogRecord {
    return {
        ts: startedAt,
        source: "worker:test",
        stream: "stdout",
        text: "hello",
        sessionId: "1761063001123",
        sessionStartedAt: 1761063001123,
        pid: 1,
        seq: 1,
        line: 0,
        ...overrides,
    };
}

function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
    return {
        meta: { sessionId: "1761063001123", startedAt: 1761063001123, status: "ended", mode: "test" },
        dir: "/tmp/logs/1761063001123",
        sizeBytes: 1024,
        segmentCount: 2,
        running: false,
        index: 1,
        ...overrides,
    };
}

const retention: RetentionUsage = {
    maxBytes: 256 * 1024 * 1024,
    maxSessions: 20,
    maxSessionBytes: 128 * 1024 * 1024,
    totalBytes: 1024,
    totalSessions: 2,
};

describe("renderLogLine", () => {
    test("formats local time, run tag, source and stream", () => {
        expect(renderLogLine(record(), { color: false })).toBe("2026-10-21 00:10:01.023  [test]  stdout  hello");
        expect(renderLogLine(record(), { color: false, runTag: 2 })).toBe("2026-10-21 00:10:01.023  #2  [test]  stdout  hello");
    });

    test("worker sources are shortened and other sources shown verbatim", () => {
        expect(formatSource("worker:api")).toBe("api");
        expect(formatSource("cookbook")).toBe("cookbook");
        expect(formatSource("typecheck:api")).toBe("typecheck:api");
        expect(renderLogLine(record({ source: "cookbook" }), { color: false })).toContain("[cookbook]");
    });

    test("emits chalk colors only when enabled", () => {
        const plain = renderLogLine(record(), { color: false });
        expect(plain).not.toContain("\x1b[");
        expect(renderLogLine(record(), { color: true })).toContain("\x1b[90m"); // time is gray
        expect(renderLogLine(record({ stream: "stderr" }), { color: true })).toContain("\x1b[31m");
        expect(renderLogLine(record({ text: "request failed" }), { color: true })).toContain("\x1b[31m");
        expect(renderLogLine(record({ stream: "system", text: "session started" }), { color: true })).toContain("\x1b[36m");
        expect(renderLogLine(record({ kind: "worker-ready", text: "ready in 10ms" }), { color: true })).toContain("\x1b[32m");
        expect(renderLogLine(record({ kind: "worker-ready-failed", text: "exited" }), { color: true })).toContain("\x1b[31m");
    });
});

describe("header and footer", () => {
    test("header shows label, mode, start time, ordering and page", () => {
        expect(renderHeader({ label: "Session #3 (running)", mode: "test", startedAt, page: 2, color: false })).toBe(
            "Session #3 (running) · test · started 2026-10-21 00:10:01.023 · newest first · page 2",
        );
        expect(renderHeader({ label: "Session #3", mode: "test", startedAt, page: 1, matches: 12, color: false })).toContain("· 12 matches");
        expect(renderHeader({ label: "Session #3", mode: "test", startedAt, page: 1, color: false, live: true })).toContain("LIVE · newest first · Ctrl+C to exit");
    });

    test("footer always includes page, line count, size and retention usage", () => {
        const footer = renderFooter({ page: 2, lines: 10, bytes: 2048, label: "Session #3", retention, color: false });
        expect(footer).toBe("Page 2 · 10 lines · ~2.0 KB · Session #3 · 2/20 sessions · 1.0 KB / 256.0 MB · newest first");
        expect(renderFooter({ page: 1, lines: 0, bytes: 0, label: "Session #3", color: false, live: true })).toContain("LIVE · 0 lines");
    });
});

describe("newest command reconstruction", () => {
    test("default command omits everything that is default", () => {
        expect(buildNewestCommand({ filters: emptyFilters(), selection: { kind: "current", sessions: [] } })).toBe("co logs");
        expect(buildNewestCommand({ filters: emptyFilters(), selection: { kind: "current", sessions: [] }, pageSize: 65536 })).toBe("co logs");
    });

    test("filters, session, page-size and count are reproduced with quoting", () => {
        const from = new Date(2026, 9, 21, 0, 0, 0, 0).getTime();
        const to = new Date(2026, 9, 21, 23, 59, 59, 999).getTime();
        const command = buildNewestCommand({
            filters: { errorsOnly: true, search: ["timeout", "a b"], from, to, project: "my project", readyOnly: false },
            selection: { kind: "id", sessions: [summary()] },
            pageSize: 128 * 1024,
            count: true,
        });
        expect(command).toBe(
            'co logs --errors --project="my project" --search=timeout --search="a b" --from="2026-10-21 00:00:00.000" --to="2026-10-21 23:59:59.999" --session=1761063001123 --page-size=128kb --count',
        );
    });

    test("--ready takes priority over --errors; all selection uses --session=all", () => {
        const command = buildNewestCommand({
            filters: { errorsOnly: true, search: [], readyOnly: true },
            selection: { kind: "all", sessions: [summary()] },
        });
        expect(command).toContain("--ready");
        expect(command).not.toContain("--errors");
        expect(command).toContain("--session=all");
    });
});

describe("more / end blocks and empty messages", () => {
    test("more block is prominent, English and copy-pasteable", () => {
        const block = renderMoreLogsBlock({ page: 1, cursor: "c1.abc", newestCommand: 'co logs --errors --search="a b"', color: false });
        const lines = block.split("\n");
        expect(lines[0]).toBe("═".repeat(76));
        expect(lines[lines.length - 1]).toBe("═".repeat(76));
        expect(block).toContain("MORE LOGS AVAILABLE — OLDER ENTRIES CONTINUE ON PAGE 2  (newest first)");
        expect(block).toContain("To view older logs, run:");
        expect(block).toContain("co logs --cursor=c1.abc");
        expect(block).toContain("To return to the newest logs, run:");
        expect(block).toContain('co logs --errors --search="a b"');
    });

    test("end block marks the last page and offers the newest command", () => {
        const block = renderEndOfLogsBlock({ newestCommand: "co logs --session=all", color: false });
        expect(block).toContain("END OF LOGS  (newest first)");
        expect(block).toContain("co logs --session=all");
    });

    test("empty page and filter summary", () => {
        expect(formatFilterSummary(emptyFilters())).toBe("no filters");
        expect(formatFilterSummary({ errorsOnly: true, search: ["a b"], readyOnly: false })).toBe('--errors --search="a b"');
        expect(renderEmptyPage({ filters: { errorsOnly: true, search: [], readyOnly: false }, color: false })).toBe("No matching log lines. (--errors)");
    });
});

describe("formatBytes", () => {
    test("uses B / KB / MB with stable precision", () => {
        expect(formatBytes(512)).toBe("512 B");
        expect(formatBytes(2048)).toBe("2.0 KB");
        expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
        expect(formatBytes(256 * 1024 * 1024)).toBe("256.0 MB");
    });
});

describe("renderSessionsList", () => {
    test("lists sessions newest first with usage and limits", () => {
        const running = summary({ running: true, sizeBytes: 2048, index: 1 });
        const ended = summary({ meta: { sessionId: "1761063001123", startedAt: 1761063001123, status: "ended", mode: "test" }, index: 2 });
        const output = renderSessionsList({
            sessions: [running, ended],
            retention: { ...retention, totalBytes: 3072 },
            logsRoot: "/tmp/logs",
            color: false,
        });
        expect(output).toContain("Sessions (newest first):");
        expect(output).toContain("#1");
        expect(output).toContain("running");
        expect(output).toContain("2.0 KB");
        expect(output).toContain("Total: 3.0 KB · 2/20 sessions · limits: 256.0 MB total, 128.0 MB per session");
        expect(output).toContain("Logs root: /tmp/logs");
    });
});
