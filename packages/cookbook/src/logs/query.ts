import { encodeCursor, serializeFilters } from "./cursor";
import { iterateDescending } from "./reader";
import {
    DEFAULT_PAGE_SIZE,
    buildNewestCommand,
    renderEmptyPage,
    renderEndOfLogsBlock,
    renderFooter,
    renderHeader,
    renderLogLine,
    renderMoreLogsBlock,
    renderNoOlderLogs,
    type RetentionUsage,
} from "./render";
import { getRetentionLimits, listSessions, type SessionSelection } from "./session";
import type { CursorState, LocatedLogRecord, LogFilters, SessionSummary } from "./types";

export interface RenderPageOptions {
    selection: SessionSelection;
    filters: LogFilters;
    /** Exclusive continuation cursor. */
    after?: CursorState;
    pageSize: number;
    count: boolean;
    /** stdout writer; called once per emitted line so no page buffer is kept. */
    write: (text: string) => void;
    color: boolean;
}

export interface RenderPageResult {
    page: number;
    printed: number;
    /** Exact only when `count === true`; otherwise `printed` plus the hasOlder probe. */
    matching: number;
    hasOlder: boolean;
    nextCursor?: string;
    /** Total matching records from the cursor position (only with `count`). */
    totalMatches?: number;
}

function retentionUsage(sessions: SessionSummary[]): RetentionUsage {
    const limits = getRetentionLimits();
    return {
        ...limits,
        totalBytes: sessions.reduce((sum, session) => sum + session.sizeBytes, 0),
        totalSessions: sessions.length,
    };
}

/**
 * Sessions to traverse for this page. A cursor only reads the session it
 * stopped in (or, for `--session all`, the sessions that started no later than
 * that session) so newer sessions are never re-read.
 */
function resolveQuerySessions(selection: SessionSelection, after: CursorState | undefined, allSessions: SessionSummary[]): SessionSummary[] {
    if (!after) return selection.sessions;
    if (after.sid === "all") return allSessions.filter((session) => session.meta.startedAt <= after.sessionStartedAt);
    const summary = allSessions.find((session) => session.meta.sessionId === after.sid);
    if (!summary) {
        throw new Error(`Session ${after.sid} is no longer available (it may have been removed by log retention). Run "co logs" to start again from the newest logs.`);
    }
    return [summary];
}

function buildRunTags(sessions: SessionSummary[]): Map<string, number> {
    const tags = new Map<string, number>();
    for (const session of sessions) tags.set(session.meta.sessionId, session.index);
    return tags;
}

function countMatchingRecords(sessions: SessionSummary[], filters: LogFilters, after: CursorState | undefined): number {
    let total = 0;
    iterateDescending({
        sessions,
        filters,
        after,
        onRecord: () => {
            total++;
        },
    });
    return total;
}

/**
 * Render one cursor page (newest first) while scanning, so memory stays O(1)
 * plus whatever the terminal needs. A page may slightly exceed `pageSize` by
 * the last complete line: lines are never split.
 */
export function renderPage(options: RenderPageOptions): RenderPageResult {
    const color = options.color;
    const pageSize = options.pageSize > 0 ? options.pageSize : DEFAULT_PAGE_SIZE;
    const page = options.after ? options.after.page + 1 : 1;

    const allSessions = listSessions();
    const retention = retentionUsage(allSessions);
    const sessions = resolveQuerySessions(options.selection, options.after, allSessions);
    const runTags = options.selection.kind === "all" ? buildRunTags(options.selection.sessions) : undefined;

    const totalMatches = options.count ? countMatchingRecords(sessions, options.filters, options.after) : undefined;

    const startedAt = options.selection.kind === "all"
        ? (options.selection.sessions[options.selection.sessions.length - 1]?.meta.startedAt ?? Date.now())
        : (options.selection.sessions[0]?.meta.startedAt ?? Date.now());
    const mode = options.selection.kind === "all" ? "mixed" : options.selection.sessions[0]?.meta.mode;

    options.write(renderHeader({ label: options.selection.label, mode, startedAt, page, matches: totalMatches, color }) + "\n");

    let printed = 0;
    let pageBytes = 0;
    let hasOlder = false;
    let lastPrinted: LocatedLogRecord | undefined;

    iterateDescending({
        sessions,
        filters: options.filters,
        after: options.after,
        onRecord: (record) => {
            const estimate = Buffer.byteLength(record.text) + 48 + Buffer.byteLength(record.source);
            if (printed > 0 && pageBytes + estimate > pageSize) {
                // The current record proves that older matching entries exist;
                // it is the hasOlder probe and will start the next page.
                hasOlder = true;
                return false;
            }
            const line = renderLogLine(record, { color, runTag: runTags?.get(record.sessionId) });
            options.write(line + "\n");
            printed++;
            pageBytes += estimate;
            lastPrinted = record;
        },
    });

    const matching = totalMatches ?? printed + (hasOlder ? 1 : 0);
    const newestCommand = buildNewestCommand({
        filters: options.filters,
        selection: options.selection,
        pageSize,
        count: options.count,
    });

    if (printed === 0) {
        if (options.after) options.write(renderNoOlderLogs({ newestCommand, filters: options.filters, color }) + "\n");
        else options.write(renderEmptyPage({ filters: options.filters, color }) + "\n");
    }

    options.write(renderFooter({ page, lines: printed, bytes: pageBytes, label: options.selection.label, retention, color }) + "\n");

    let nextCursor: string | undefined;
    if (hasOlder && lastPrinted) {
        const sid = options.after ? options.after.sid : options.selection.kind === "all" ? "all" : options.selection.sessions[0].meta.sessionId;
        nextCursor = encodeCursor({
            v: 1,
            sid,
            sessionStartedAt: lastPrinted.sessionStartedAt,
            ts: lastPrinted.ts,
            pid: lastPrinted.pid,
            seq: lastPrinted.seq,
            line: lastPrinted.line,
            page,
            filters: serializeFilters(options.filters),
            pageSize,
        });
        options.write("\n" + renderMoreLogsBlock({ page, cursor: nextCursor, newestCommand, color }) + "\n");
    } else if (page > 1 && printed > 0) {
        options.write("\n" + renderEndOfLogsBlock({ newestCommand, color }) + "\n");
    }

    return { page, printed, matching, hasOlder, nextCursor, totalMatches };
}
