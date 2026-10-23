import { Chalk } from "chalk";
import { isErrorRecord } from "./error-keywords";
import type { SessionSelection } from "./session";
import { formatTimestamp } from "./time";
import type { LocatedLogRecord, LogFilters, SessionSummary } from "./types";

/** Default cursor page budget (64 KB of estimated record bytes). */
export const DEFAULT_PAGE_SIZE = 65536;

/** Full-width rule used by the "there is more" / "end of logs" blocks. */
const RULE = "═".repeat(76);

export interface RetentionUsage {
    maxBytes: number;
    maxSessions: number;
    maxSessionBytes: number;
    totalBytes: number;
    totalSessions: number;
}

export interface ColorOptions {
    /** When false every helper returns plain text (for `--no-color` / non-TTY). */
    color: boolean;
}

function createPalette(enabled: boolean) {
    const chalk = new Chalk({ level: enabled ? 1 : 0 });
    return {
        gray: (text: string) => chalk.gray(text),
        red: (text: string) => chalk.red(text),
        green: (text: string) => chalk.green(text),
        cyan: (text: string) => chalk.cyan(text),
        yellowBold: (text: string) => chalk.bold.yellow(text),
        muted: (text: string) => chalk.gray(text),
        accent: (text: string) => chalk.cyan(text),
        bold: (text: string) => chalk.bold(text),
    };
}

function isReadyKind(record: LocatedLogRecord): boolean {
    return typeof record.kind === "string" && record.kind.startsWith("worker-ready");
}

function isReadyFailure(record: LocatedLogRecord): boolean {
    return record.kind === "worker-ready-failed" || record.kind === "worker-ready-timeout";
}

function isReadySuccess(record: LocatedLogRecord): boolean {
    return record.kind === "worker-ready";
}

/** `worker:test` is displayed as `[test]`; every other source is shown verbatim. */
export function formatSource(source: string): string {
    const workerPrefix = "worker:";
    return source.startsWith(workerPrefix) ? source.slice(workerPrefix.length) : source;
}

/** `<time>  [#<run>]  [<source>]  <stream>  <text>` — the single-line log format. */
export function renderLogLine(record: LocatedLogRecord, options: ColorOptions & { runTag?: number }): string {
    const palette = createPalette(options.color);
    const time = palette.gray(formatTimestamp(record.ts));
    const runTag = options.runTag !== undefined ? `  ${palette.accent(`#${options.runTag}`)}` : "";
    const line = `${time}${runTag}  [${formatSource(record.source)}]  ${record.stream}  ${record.text}`;

    if (isReadyFailure(record)) return palette.red(line);
    if (isReadySuccess(record)) return palette.green(line);
    if (isErrorRecord(record)) return palette.red(line);
    if (record.stream === "system") return palette.cyan(line);
    if (isReadyKind(record)) return palette.muted(line);
    return line;
}

export interface HeaderOptions extends ColorOptions {
    label: string;
    mode?: string;
    startedAt: number;
    page: number;
    /** Only passed with `--count`; appended as `· <N> matches`. */
    matches?: number;
    live?: boolean;
}

/** Header line: `<label> · <mode> · started <time> · newest first · page <n>`. */
export function renderHeader(options: HeaderOptions): string {
    const palette = createPalette(options.color);
    const label = palette.bold(options.label);
    const started = `started ${formatTimestamp(options.startedAt)}`;

    if (options.live) {
        const mode = options.mode !== undefined ? ` · ${options.mode}` : "";
        return `${label}${mode} · ${started} · ${palette.accent("LIVE")} · newest first · Ctrl+C to exit`;
    }

    const parts = [label];
    if (options.mode !== undefined) parts.push(options.mode);
    parts.push(started, "newest first", `page ${options.page}`);
    if (options.matches !== undefined) parts.push(`${options.matches} matches`);
    return parts.join(" · ");
}

export interface FooterOptions extends ColorOptions {
    page: number;
    lines: number;
    bytes: number;
    label: string;
    retention?: RetentionUsage;
    live?: boolean;
}

function formatRetention(retention: RetentionUsage): string {
    return `${retention.totalSessions}/${retention.maxSessions} sessions · ${formatBytes(retention.totalBytes)} / ${formatBytes(retention.maxBytes)}`;
}

/** Always-printed compact summary footer. */
export function renderFooter(options: FooterOptions): string {
    const parts: string[] = [];
    if (options.live) {
        parts.push("LIVE", `${options.lines} lines`, `~${formatBytes(options.bytes)}`, options.label);
    } else {
        parts.push(`Page ${options.page}`, `${options.lines} lines`, `~${formatBytes(options.bytes)}`, options.label);
    }
    if (options.retention) parts.push(formatRetention(options.retention));
    parts.push(options.live ? "Ctrl+C to exit" : "newest first");
    return parts.join(" · ");
}

function quoteValue(value: string): string {
    return /[\s"']/.test(value) ? `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : value;
}

function formatPageSize(pageSize: number): string {
    return pageSize % 1024 === 0 ? `${pageSize / 1024}kb` : String(pageSize);
}

/** Ordered flags that reproduce a filter set (without the `co logs` prefix). */
function buildFilterFlags(filters: LogFilters): string[] {
    const parts: string[] = [];
    if (filters.readyOnly) parts.push("--ready");
    else if (filters.errorsOnly) parts.push("--errors");
    if (filters.project !== undefined) parts.push(`--project=${quoteValue(filters.project)}`);
    for (const term of filters.search) parts.push(`--search=${quoteValue(term)}`);
    if (filters.from !== undefined) parts.push(`--from=${quoteValue(formatTimestamp(filters.from))}`);
    if (filters.to !== undefined) parts.push(`--to=${quoteValue(formatTimestamp(filters.to))}`);
    return parts;
}

/** Human-readable filter summary used by the empty-page messages. */
export function formatFilterSummary(filters: LogFilters): string {
    const flags = buildFilterFlags(filters);
    return flags.length > 0 ? flags.join(" ") : "no filters";
}

export interface NewestCommandOptions {
    filters: LogFilters;
    selection: Pick<SessionSelection, "kind" | "sessions">;
    pageSize?: number;
    count?: boolean;
}

/**
 * Reconstruct the closest command that shows the newest page with the same
 * session/filters (copy-pasteable, values containing spaces are quoted).
 */
export function buildNewestCommand(options: NewestCommandOptions): string {
    const parts = ["co", "logs", ...buildFilterFlags(options.filters)];

    if (options.selection.kind === "all") {
        parts.push("--session=all");
    } else if ((options.selection.kind === "id" || options.selection.kind === "index") && options.selection.sessions[0]) {
        parts.push(`--session=${quoteValue(options.selection.sessions[0].meta.sessionId)}`);
    }

    if (options.pageSize !== undefined && options.pageSize !== DEFAULT_PAGE_SIZE) {
        parts.push(`--page-size=${formatPageSize(options.pageSize)}`);
    }
    if (options.count) parts.push("--count");
    return parts.join(" ");
}

export interface MoreLogsOptions extends ColorOptions {
    page: number;
    cursor: string;
    newestCommand: string;
}

/** Prominent English block shown when older entries can be paged through. */
export function renderMoreLogsBlock(options: MoreLogsOptions): string {
    const palette = createPalette(options.color);
    return [
        RULE,
        `  ${palette.yellowBold(`MORE LOGS AVAILABLE — OLDER ENTRIES CONTINUE ON PAGE ${options.page + 1}  (newest first)`)}`,
        "",
        "  To view older logs, run:",
        `      ${palette.accent(`co logs --cursor=${options.cursor}`)}`,
        "",
        "  To return to the newest logs, run:",
        `      ${palette.accent(options.newestCommand)}`,
        RULE,
    ].join("\n");
}

export interface EndOfLogsOptions extends ColorOptions {
    newestCommand: string;
}

/** Shown on the last page (page > 1) when there is nothing older. */
export function renderEndOfLogsBlock(options: EndOfLogsOptions): string {
    const palette = createPalette(options.color);
    return [
        RULE,
        `  ${palette.yellowBold("END OF LOGS  (newest first)")}`,
        "",
        "  To return to the newest logs, run:",
        `      ${palette.accent(options.newestCommand)}`,
        RULE,
    ].join("\n");
}

export interface NoOlderLogsOptions extends ColorOptions {
    newestCommand: string;
    filters: LogFilters;
}

/** Shown when a cursor page yields no records at all. */
export function renderNoOlderLogs(options: NoOlderLogsOptions): string {
    return [`No older logs. (${formatFilterSummary(options.filters)})`, "", "  To return to the newest logs, run:", `      ${options.newestCommand}`].join("\n");
}

export interface EmptyPageOptions extends ColorOptions {
    filters: LogFilters;
}

/** Friendly empty result message. */
export function renderEmptyPage(options: EmptyPageOptions): string {
    return `No matching log lines. (${formatFilterSummary(options.filters)})`;
}

export interface SessionsListOptions extends ColorOptions {
    sessions: SessionSummary[];
    retention: RetentionUsage;
    logsRoot: string;
}

/** `co logs --sessions` output. */
export function renderSessionsList(options: SessionsListOptions): string {
    const lines = ["Sessions (newest first):"];
    for (const session of options.sessions) {
        const meta = session.meta;
        const started = formatTimestamp(meta.startedAt);
        const mode = meta.mode ?? "-";
        const status = session.running ? "running" : meta.status;
        const segments = `${session.segmentCount} segment${session.segmentCount === 1 ? "" : "s"}`;
        lines.push(`  #${String(session.index).padEnd(2)}  ${meta.sessionId}  ${mode.padEnd(8)}  ${status.padEnd(8)}  ${started}  ${formatBytes(session.sizeBytes).padStart(9)}  ${segments}`);
    }
    lines.push(
        `Total: ${formatBytes(options.retention.totalBytes)} · ${options.retention.totalSessions}/${options.retention.maxSessions} sessions · limits: ${formatBytes(options.retention.maxBytes)} total, ${formatBytes(options.retention.maxSessionBytes)} per session`,
    );
    lines.push(`Logs root: ${options.logsRoot}`);
    return lines.join("\n");
}

/** `4.2 KB` / `512 B` / `1.5 MB` — sizes are always shown with one decimal for KB/MB. */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
