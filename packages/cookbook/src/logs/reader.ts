import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { compareDesc, isRecordAfterCursor } from "./cursor";
import { isErrorRecord } from "./error-keywords";
import type { CursorState, LocatedLogRecord, LogFilters, LogRecord, LogStream, SessionSummary } from "./types";

const SEGMENT_FILE = /^(\d+)-(\d+)\.jsonl$/;
const NEWLINE = 0x0a;
const CARRIAGE_RETURN = 0x0d;

export interface IterateOptions {
    /** Sessions ordered newest first. */
    sessions: SessionSummary[];
    filters: LogFilters;
    /** Exclusive continuation cursor: only records strictly older than it are emitted. */
    after?: CursorState;
    /** Return `false` to stop the traversal early. */
    onRecord: (record: LocatedLogRecord) => boolean | void;
}

export interface ReaderStats {
    segmentsRead: number;
    recordsRead: number;
    bytesRead: number;
}

export interface IterateResult extends ReaderStats {
    /** True when the callback asked to stop (or `--from` early-stopped). */
    stopped: boolean;
}

interface SegmentFile {
    name: string;
    path: string;
    seq: number;
}

interface PidStream {
    sessionId: string;
    sessionStartedAt: number;
    pid: number;
    files: SegmentFile[];
    fileIndex: number;
    buffer?: Buffer;
    /** Byte offset one past the last complete line considered in `buffer`. */
    pos: number;
    seq: number;
}

function normalizeStream(value: unknown): LogStream {
    return value === "stdout" || value === "stderr" || value === "system" ? value : "stdout";
}

/**
 * Parse one JSONL line into a `LogRecord`. Corrupt / truncated / non-object
 * lines return `undefined` and are skipped by the reader.
 */
export function parseLogRecordLine(line: Buffer): LogRecord | undefined {
    if (line.length === 0) return undefined;
    let parsed: any;
    try {
        parsed = JSON.parse(line.toString("utf-8"));
    } catch {
        return undefined;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    if (typeof parsed.ts !== "number" || !Number.isFinite(parsed.ts)) return undefined;
    if (typeof parsed.text !== "string") return undefined;

    const record: LogRecord = {
        ts: parsed.ts,
        source: typeof parsed.source === "string" ? parsed.source : "",
        stream: normalizeStream(parsed.stream),
        text: parsed.text,
    };
    if (typeof parsed.err === "boolean") record.err = parsed.err;
    if (typeof parsed.kind === "string") record.kind = parsed.kind;
    if (parsed.meta && typeof parsed.meta === "object" && !Array.isArray(parsed.meta)) record.meta = parsed.meta as Record<string, unknown>;
    return record;
}

/** Position one-past the last complete (newline terminated) line. */
function completeEnd(buffer: Buffer): number {
    if (buffer.length === 0) return 0;
    if (buffer[buffer.length - 1] === NEWLINE) return buffer.length;
    const previousNewline = buffer.lastIndexOf(NEWLINE);
    return previousNewline < 0 ? 0 : previousNewline + 1;
}

function listSegmentFiles(dir: string): Array<SegmentFile> {
    let entries: Array<string>;
    try {
        entries = readdirSync(dir);
    } catch {
        return [];
    }
    const files: Array<SegmentFile> = [];
    for (const name of entries) {
        const match = SEGMENT_FILE.exec(name);
        if (!match) continue;
        files.push({ name, path: join(dir, name), seq: Number(match[2]) });
    }
    return files;
}

function groupByPid(dir: string): Map<number, SegmentFile[]> {
    const grouped = new Map<number, SegmentFile[]>();
    for (const file of listSegmentFiles(dir)) {
        const match = SEGMENT_FILE.exec(file.name)!;
        const pid = Number(match[1]);
        const list = grouped.get(pid);
        if (list) list.push(file);
        else grouped.set(pid, [file]);
    }
    // Newest segment first: we walk the session backwards in time, one loaded
    // segment per pid at a time.
    for (const files of grouped.values()) files.sort((a, b) => b.seq - a.seq);
    return grouped;
}

function createStream(summary: SessionSummary, pid: number, files: SegmentFile[]): PidStream {
    return {
        sessionId: summary.meta.sessionId,
        sessionStartedAt: summary.meta.startedAt,
        pid,
        files,
        fileIndex: 0,
        pos: 0,
        seq: 0,
    };
}

function loadNextSegment(stream: PidStream, stats: ReaderStats): boolean {
    while (stream.fileIndex < stream.files.length) {
        const file = stream.files[stream.fileIndex++];
        let buffer: Buffer;
        try {
            buffer = readFileSync(file.path);
        } catch {
            continue;
        }
        stats.segmentsRead++;
        stats.bytesRead += buffer.length;
        stream.seq = file.seq;
        stream.buffer = buffer;
        stream.pos = completeEnd(buffer);
        return true;
    }
    stream.buffer = undefined;
    stream.pos = 0;
    return false;
}

/**
 * Return the next record walking this pid's segments backwards in time, or
 * `undefined` when the pid has no older records left. A trailing partial line
 * (no trailing `\n`) is ignored; corrupt JSON lines are skipped.
 */
function readNextRecord(stream: PidStream, stats: ReaderStats): LocatedLogRecord | undefined {
    for (;;) {
        while (stream.buffer && stream.pos > 0) {
            const lineEnd = stream.pos - 1;
            const lineStart = stream.buffer.lastIndexOf(NEWLINE, lineEnd - 1) + 1;
            const contentEnd = lineEnd > lineStart && stream.buffer[lineEnd - 1] === CARRIAGE_RETURN ? lineEnd - 1 : lineEnd;
            const line = stream.buffer.subarray(lineStart, contentEnd);
            stream.pos = lineStart;

            const parsed = parseLogRecordLine(line);
            if (!parsed) continue;
            stats.recordsRead++;
            return {
                ...parsed,
                sessionId: stream.sessionId,
                sessionStartedAt: stream.sessionStartedAt,
                pid: stream.pid,
                seq: stream.seq,
                // Byte offset of the line start: the stable cursor tie-break.
                line: lineStart,
            };
        }
        stream.buffer = undefined;
        stream.pos = 0;
        if (!loadNextSegment(stream, stats)) return undefined;
    }
}

function sessionSearchText(record: LocatedLogRecord): string {
    return record.text.toLowerCase();
}

/** True when the record passes every filter (used by the reader and by follow). */
export function matchesFilters(record: LocatedLogRecord, filters: LogFilters): boolean {
    if (filters.from !== undefined && record.ts < filters.from) return false;
    if (filters.to !== undefined && record.ts > filters.to) return false;

    if (filters.readyOnly) {
        if (typeof record.kind !== "string" || !record.kind.startsWith("worker-ready")) return false;
    } else if (filters.errorsOnly && !isErrorRecord(record)) {
        return false;
    }

    if (filters.project !== undefined) {
        const project = filters.project;
        if (record.source !== `worker:${project}` && record.meta?.project !== project) return false;
    }

    if (filters.search.length > 0) {
        const text = sessionSearchText(record);
        for (const term of filters.search) {
            if (!text.includes(term.toLowerCase())) return false;
        }
    }
    return true;
}

/**
 * True when the record lies strictly after the cursor in the descending
 * traversal direction.
 *
 * `isRecordAfterCursor` handles single-session cursors. In `--session all`
 * mode a cursor whose `sid` is `"all"` cannot name the session it stopped in,
 * so the same-session tie-break is resolved with `compareDesc` here.
 */
function isAfterCursor(record: LocatedLogRecord, cursor: CursorState): boolean {
    if (cursor.sid !== "all") return isRecordAfterCursor(record, cursor);
    if (record.sessionStartedAt !== cursor.sessionStartedAt) return record.sessionStartedAt < cursor.sessionStartedAt;
    return compareDesc(record, cursor) > 0;
}

function shouldSkipSession(summary: SessionSummary, after: CursorState | undefined): boolean {
    if (!after) return false;
    if (after.sid === "all") return summary.meta.startedAt > after.sessionStartedAt;
    return summary.meta.sessionId !== after.sid;
}

/**
 * Walk every requested session newest-first, merging the per-pid segment
 * streams in descending timestamp order.
 *
 * Memory use is O(number of writing pids): at most one segment (~512 KB) is
 * loaded per pid at any time, and lines are decoded one at a time.
 */
export function iterateDescending(options: IterateOptions): IterateResult {
    const stats: ReaderStats = { segmentsRead: 0, recordsRead: 0, bytesRead: 0 };
    const filters = options.filters;
    const after = options.after;
    let stopped = false;

    outer: for (const summary of options.sessions) {
        if (shouldSkipSession(summary, after)) continue;

        const streams: PidStream[] = [];
        for (const [pid, files] of groupByPid(summary.dir)) streams.push(createStream(summary, pid, files));
        if (streams.length === 0) continue;

        // One peeked head record per pid, then a k-way merge on compareDesc.
        const heads: Array<LocatedLogRecord | undefined> = streams.map((stream) => readNextRecord(stream, stats));

        for (;;) {
            let bestIndex = -1;
            for (let index = 0; index < heads.length; index++) {
                const head = heads[index];
                if (!head) continue;
                if (bestIndex < 0 || compareDesc(head, heads[bestIndex]!) < 0) bestIndex = index;
            }
            if (bestIndex < 0) break;

            const record = heads[bestIndex]!;

            // Descending order: nothing older than the `--from` boundary can match.
            if (filters.from !== undefined && record.ts < filters.from) {
                stopped = true;
                break outer;
            }

            if (after && !isAfterCursor(record, after)) {
                heads[bestIndex] = readNextRecord(streams[bestIndex], stats);
                continue;
            }
            if (!matchesFilters(record, filters)) {
                heads[bestIndex] = readNextRecord(streams[bestIndex], stats);
                continue;
            }

            // Advance only after the callback asks to continue, so an early stop
            // never reads (or even loads) the next segment.
            if (options.onRecord(record) === false) {
                stopped = true;
                break outer;
            }
            heads[bestIndex] = readNextRecord(streams[bestIndex], stats);
        }
    }

    return { ...stats, stopped };
}
