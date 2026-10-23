import { closeSync, openSync, readSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { compareDesc } from "./cursor";
import { iterateDescending, matchesFilters, parseLogRecordLine } from "./reader";
import { DEFAULT_PAGE_SIZE, renderFooter, renderHeader, renderLogLine, type RetentionUsage } from "./render";
import { getRetentionLimits, isSessionRunning, listSessions, sessionLabel } from "./session";
import type { LocatedLogRecord, LogFilters, SessionSummary } from "./types";

const SEGMENT_FILE = /^(\d+)-(\d+)\.jsonl$/;
const NEWLINE = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const CLEAR_SCREEN = "\x1b[H\x1b[2J";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";

export interface FollowOptions {
    /** The current running session (the only session follow supports). */
    session: SessionSummary;
    filters: LogFilters;
    /** Byte budget for the bounded deque (default 64 KB). */
    pageSize?: number;
    color: boolean;
    write: (text: string) => void;
    /** Defaults to `process.stdout.isTTY`; injectable for tests. */
    isTTY?: boolean;
    /** Poll interval in ms (default 500). */
    pollMs?: number;
    /** Tests disable the timer and drive `tick()` manually. */
    autoTick?: boolean;
    /** Defaults to `process.exit`; injectable for tests. */
    exit?: (code: number) => void;
}

export interface FollowHandle {
    /** Read appended bytes, prepend matching lines and redraw. */
    tick(): void;
    /** Stop polling and restore the terminal cursor without exiting. */
    stop(): void;
    /** Simulate Ctrl+C: restore the cursor and exit 130. */
    interrupt(): void;
    /** Currently displayed newest-first lines. */
    lines(): string[];
}

interface DequeEntry {
    line: string;
    bytes: number;
}

interface SegmentFileInfo {
    name: string;
    path: string;
    pid: number;
    seq: number;
}

function listSegmentFiles(dir: string): SegmentFileInfo[] {
    let entries: Array<string>;
    try {
        entries = readdirSync(dir);
    } catch {
        return [];
    }
    const files: SegmentFileInfo[] = [];
    for (const name of entries) {
        const match = SEGMENT_FILE.exec(name);
        if (!match) continue;
        files.push({ name, path: join(dir, name), pid: Number(match[1]), seq: Number(match[2]) });
    }
    files.sort((a, b) => a.pid - b.pid || a.seq - b.seq);
    return files;
}

function readAppendedBytes(path: string, offset: number, size: number): Buffer | undefined {
    if (size <= offset) return undefined;
    let fd: number | undefined;
    try {
        fd = openSync(path, "r");
        const buffer = Buffer.allocUnsafe(size - offset);
        let position = 0;
        while (position < buffer.length) {
            const read = readSync(fd, buffer, position, buffer.length - position, offset + position);
            if (read <= 0) break;
            position += read;
        }
        return buffer.subarray(0, position);
    } catch {
        return undefined;
    } finally {
        if (fd !== undefined) {
            try {
                closeSync(fd);
            } catch {
                // ignore
            }
        }
    }
}

/**
 * Live (`co logs -f`) view of the current running session.
 *
 * Only bytes appended after the follow starts are read (offset per segment
 * file, partial-line buffer), matching records are prepended to a byte-bounded
 * deque and the screen is redrawn with ANSI clear. No full-history rescans.
 */
export function followSession(options: FollowOptions): FollowHandle {
    const isTTY = options.isTTY ?? Boolean(process.stdout.isTTY);
    if (!isTTY) throw new Error("Live follow requires an interactive terminal (TTY). Run without --follow to read log pages.");

    const session = options.session;
    const sessionId = session.meta.sessionId;
    const sessionStartedAt = session.meta.startedAt;
    const pageSize = options.pageSize !== undefined && options.pageSize > 0 ? options.pageSize : DEFAULT_PAGE_SIZE;
    const write = options.write;
    const exit = options.exit ?? ((code: number) => process.exit(code));
    const pollMs = options.pollMs ?? 500;

    const entries: DequeEntry[] = [];
    const offsets = new Map<string, number>();
    const partials = new Map<string, Buffer>();
    let totalBytes = 0;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const trim = () => {
        while (entries.length > 1 && totalBytes > pageSize) {
            const removed = entries.pop()!;
            totalBytes -= removed.bytes;
        }
    };

    const prependRecords = (records: LocatedLogRecord[]) => {
        if (records.length === 0) return;
        records.sort((a, b) => compareDesc(a, b));
        const fresh: DequeEntry[] = records.map((record) => {
            const line = renderLogLine(record, { color: options.color });
            return { line, bytes: Buffer.byteLength(line) + 1 };
        });
        entries.unshift(...fresh);
        for (const entry of fresh) totalBytes += entry.bytes;
        trim();
    };

    const retention = (): RetentionUsage => {
        const sessions = listSessions();
        const limits = getRetentionLimits();
        return { ...limits, totalBytes: sessions.reduce((sum, item) => sum + item.sizeBytes, 0), totalSessions: sessions.length };
    };

    const buildFrame = (): string => {
        const label = sessionLabel(session);
        const header = renderHeader({
            label,
            mode: session.meta.mode,
            startedAt: sessionStartedAt,
            page: 1,
            color: options.color,
            live: true,
        });
        const footer = renderFooter({ page: 1, lines: entries.length, bytes: totalBytes, label, retention: retention(), color: options.color, live: true });
        const body = entries.map((entry) => entry.line).join("\n");
        return `${header}\n${body}${body ? "\n" : ""}${footer}\n`;
    };

    const redraw = () => {
        write(CLEAR_SCREEN + buildFrame());
    };

    const seedNewestPage = () => {
        iterateDescending({
            sessions: [session],
            filters: options.filters,
            onRecord: (record) => {
                const line = renderLogLine(record, { color: options.color });
                const bytes = Buffer.byteLength(line) + 1;
                if (entries.length > 0 && totalBytes + bytes > pageSize) return false;
                entries.push({ line, bytes });
                totalBytes += bytes;
            },
        });
    };

    const initialiseOffsets = () => {
        for (const file of listSegmentFiles(session.dir)) {
            try {
                offsets.set(file.name, statSync(file.path).size);
            } catch {
                offsets.set(file.name, 0);
            }
        }
    };

    const ingestAppended = (): LocatedLogRecord[] => {
        const fresh: LocatedLogRecord[] = [];
        for (const file of listSegmentFiles(session.dir)) {
            let size: number;
            try {
                size = statSync(file.path).size;
            } catch {
                continue;
            }
            let offset = offsets.get(file.name) ?? 0;
            if (size < offset) offset = 0; // rotated / truncated file: restart from 0
            if (size <= offset) {
                offsets.set(file.name, offset);
                continue;
            }
            const chunk = readAppendedBytes(file.path, offset, size);
            offsets.set(file.name, size);
            if (!chunk || chunk.length === 0) continue;

            const previous = partials.get(file.name);
            const data = previous && previous.length > 0 ? Buffer.concat([previous, chunk]) : chunk;
            const lastNewline = data.lastIndexOf(NEWLINE);
            if (lastNewline < 0) {
                partials.set(file.name, data);
                continue;
            }
            partials.set(file.name, data.subarray(lastNewline + 1));

            let lineStart = 0;
            for (let index = 0; index <= lastNewline; index++) {
                if (data[index] !== NEWLINE) continue;
                const contentEnd = index > lineStart && data[index - 1] === CARRIAGE_RETURN ? index - 1 : index;
                const record = parseLogRecordLine(data.subarray(lineStart, contentEnd));
                lineStart = index + 1;
                if (!record) continue;
                const located: LocatedLogRecord = { ...record, sessionId, sessionStartedAt, pid: file.pid, seq: file.seq, line: 0 };
                if (matchesFilters(located, options.filters)) fresh.push(located);
            }
        }
        return fresh;
    };

    let sigintHandler: (() => void) | undefined;

    const stopInternal = () => {
        if (stopped) return;
        stopped = true;
        if (timer !== undefined) clearInterval(timer);
        timer = undefined;
        if (sigintHandler) process.removeListener("SIGINT", sigintHandler);
    };

    const showCursor = () => write(SHOW_CURSOR);

    const tick = () => {
        if (stopped) return;

        const running = isSessionRunning(sessionId);
        if (!running) {
            redraw();
            write(`${SHOW_CURSOR}\nSession ended. Live follow stopped.\n`);
            stopInternal();
            exit(0);
            return;
        }

        const fresh = ingestAppended();
        if (fresh.length > 0) {
            prependRecords(fresh);
            redraw();
        }
    };

    const onSigint = () => {
        interrupt();
    };

    const interrupt = () => {
        if (stopped) return;
        stopInternal();
        write(`${SHOW_CURSOR}\n`);
        exit(130);
    };

    sigintHandler = onSigint;

    seedNewestPage();
    initialiseOffsets();
    write(HIDE_CURSOR);
    redraw();
    process.on("SIGINT", onSigint);
    if (options.autoTick !== false) timer = setInterval(tick, pollMs);

    return {
        tick,
        stop: () => {
            stopInternal();
            showCursor();
        },
        interrupt,
        lines: () => entries.map((entry) => entry.line),
    };
}
