import type { CursorKey, CursorState, LocatedLogRecord, LogFilters, SerializedFilters } from "./types";

const CURSOR_PREFIX = "c1.";

export function serializeFilters(filters: LogFilters): SerializedFilters {
    const serialized: SerializedFilters = {
        e: filters.errorsOnly ? 1 : 0,
        q: [...filters.search],
        r: filters.readyOnly ? 1 : 0,
    };
    if (filters.from !== undefined) serialized.f = filters.from;
    if (filters.to !== undefined) serialized.t = filters.to;
    if (filters.project !== undefined) serialized.p = filters.project;
    return serialized;
}

export function deserializeFilters(filters: SerializedFilters): LogFilters {
    return {
        errorsOnly: filters.e === 1,
        search: Array.isArray(filters.q) ? [...filters.q] : [],
        from: typeof filters.f === "number" ? filters.f : undefined,
        to: typeof filters.t === "number" ? filters.t : undefined,
        project: typeof filters.p === "string" ? filters.p : undefined,
        readyOnly: filters.r === 1,
    };
}

export function encodeCursor(state: CursorState): string {
    return CURSOR_PREFIX + Buffer.from(JSON.stringify(state), "utf-8").toString("base64url");
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

export function decodeCursor(token: string): CursorState {
    if (!token.startsWith(CURSOR_PREFIX)) {
        throw new Error(`Invalid cursor token. Run "co logs" to start again from the newest logs.`);
    }
    let parsed: any;
    try {
        parsed = JSON.parse(Buffer.from(token.slice(CURSOR_PREFIX.length), "base64url").toString("utf-8"));
    } catch {
        throw new Error(`Invalid cursor token. Run "co logs" to start again from the newest logs.`);
    }
    if (
        !parsed ||
        parsed.v !== 1 ||
        typeof parsed.sid !== "string" ||
        !isFiniteNumber(parsed.ts) ||
        !isFiniteNumber(parsed.pid) ||
        !isFiniteNumber(parsed.seq) ||
        !isFiniteNumber(parsed.line) ||
        !isFiniteNumber(parsed.sessionStartedAt) ||
        !isFiniteNumber(parsed.page) ||
        !isFiniteNumber(parsed.pageSize) ||
        !parsed.filters ||
        !Array.isArray(parsed.filters.q)
    ) {
        throw new Error(`Invalid cursor token. Run "co logs" to start again from the newest logs.`);
    }
    return {
        v: 1,
        sid: parsed.sid,
        ts: parsed.ts,
        pid: parsed.pid,
        seq: parsed.seq,
        line: parsed.line,
        sessionStartedAt: parsed.sessionStartedAt,
        page: Math.max(1, Math.round(parsed.page)),
        pageSize: parsed.pageSize,
        filters: {
            e: parsed.filters.e === 1 ? 1 : 0,
            q: parsed.filters.q.filter((item: unknown): item is string => typeof item === "string"),
            f: isFiniteNumber(parsed.filters.f) ? parsed.filters.f : undefined,
            t: isFiniteNumber(parsed.filters.t) ? parsed.filters.t : undefined,
            p: typeof parsed.filters.p === "string" ? parsed.filters.p : undefined,
            r: parsed.filters.r === 1 ? 1 : 0,
        },
    } as CursorState;
}

/**
 * Descending order comparator: negative when `a` should be displayed before
 * `b` (i.e. `a` is newer). Ties are broken deterministically by pid / segment /
 * line so a cursor can always resume at an exact position.
 */
export function compareDesc(a: CursorKey, b: CursorKey): number {
    return b.ts - a.ts || b.pid - a.pid || b.seq - a.seq || b.line - a.line;
}

/**
 * True when the record lies strictly after the cursor in the traversal
 * direction (i.e. it is older and should be shown by the next page).
 */
export function isRecordAfterCursor(record: LocatedLogRecord, cursor: CursorState): boolean {
    if (cursor.sid !== "all") {
        return record.sessionId === cursor.sid && compareDesc(record, cursor) > 0;
    }
    if (record.sessionStartedAt !== cursor.sessionStartedAt) {
        return record.sessionStartedAt < cursor.sessionStartedAt;
    }
    // Same session: `sid: "all"` does not name a session, so the record's own
    // session id is the same as the cursor's session; fall back to the record
    // order (ts / pid / seq / line offset) only.
    return compareDesc(record, cursor) > 0;
}
