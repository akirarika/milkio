export type LogStream = "stdout" | "stderr" | "system";

/**
 * One line of log output as stored in a JSONL segment file.
 *
 * Records are written by exactly one process (the segment file is named after
 * its pid), so `ts` is monotonic within a segment (clamped on clock jumps).
 * `err` is precomputed at write time so that querying "only errors" never has
 * to re-scan the text.
 */
export interface LogRecord {
    /** epoch milliseconds */
    ts: number;
    source: string;
    stream: LogStream;
    /** single line, ANSI sequences already stripped */
    text: string;
    err?: boolean;
    /** optional structured event kind, e.g. "worker-ready" */
    kind?: string;
    /** optional structured payload (project, url, readyMs, attempts, exitCode, ...) */
    meta?: Record<string, unknown>;
}

/** Location metadata attached by the reader (not stored in the JSONL file). */
export interface RecordOrigin {
    sessionId: string;
    sessionStartedAt: number;
    pid: number;
    seq: number;
    /** 0-based line index inside the segment file */
    line: number;
}

export type LocatedLogRecord = LogRecord & RecordOrigin;

export interface LogFilters {
    errorsOnly: boolean;
    /** case-insensitive substring terms, all must match (AND) */
    search: Array<string>;
    /** inclusive epoch ms */
    from?: number;
    /** inclusive epoch ms */
    to?: number;
    project?: string;
    readyOnly: boolean;
}

/** Compact form stored inside a cursor token. */
export interface SerializedFilters {
    e: 0 | 1;
    q: Array<string>;
    f?: number;
    t?: number;
    p?: string;
    r: 0 | 1;
}

/** Stable tie-break key for one record, ordered descending. */
export interface CursorKey {
    ts: number;
    pid: number;
    seq: number;
    line: number;
}

/**
 * A cursor is a bookmark (not a page number): it points at the last record that
 * was already displayed, plus the filters/session/page-size needed to continue
 * in the "older" direction. New records arriving at the top never shift it.
 */
export interface CursorState extends CursorKey {
    /** payload version */
    v: 1;
    /** session id, or "all" when all retained sessions are merged */
    sid: string;
    sessionStartedAt: number;
    /** 1-based page ordinal, only used for display */
    page: number;
    filters: SerializedFilters;
    pageSize: number;
}

export type SessionStatus = "running" | "ended" | "crashed" | "failed" | "replaced" | "legacy" | "unknown";

export interface SessionMeta {
    sessionId: string;
    /** epoch ms, derived from the session id */
    startedAt: number;
    endedAt?: number;
    status: SessionStatus;
    mode?: string;
    /** the live process owning this session (background dev / test process) */
    pid?: number;
    cwd?: string;
    note?: string;
    exitCode?: number | null;
    version?: string;
    /** epoch ms of the last collector heartbeat */
    lastWriteAt?: number;
}

export interface SessionSummary {
    meta: SessionMeta;
    dir: string;
    sizeBytes: number;
    segmentCount: number;
    running: boolean;
    /** 1-based index, newest first */
    index: number;
}
