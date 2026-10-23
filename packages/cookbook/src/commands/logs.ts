import { defineCookbookCommand } from "@milkio/cookbook-command";
import { exit, stdout } from "node:process";
import { decodeCursor, deserializeFilters } from "../logs/cursor";
import { followSession } from "../logs/follow";
import { renderPage } from "../logs/query";
import { DEFAULT_PAGE_SIZE, renderSessionsList } from "../logs/render";
import { getLogsRoot, getRetentionLimits, listSessions, readCurrentSession, resolveSessionSelection, sessionLabel, type SessionSelection } from "../logs/session";
import { parsePageSize, parseTimeBoundary } from "../logs/time";
import type { CursorState, LogFilters } from "../logs/types";

interface ParsedLogsArguments {
    sessions: boolean;
    session?: string;
    cursor?: string;
    errors: boolean;
    ready: boolean;
    project?: string;
    search: string[];
    from?: string;
    to?: string;
    pageSize?: string;
    count: boolean;
    color: boolean;
    follow: boolean;
}

const VALUE_FLAGS = new Set(["--session", "--cursor", "--project", "--search", "--from", "--to", "--page-size", "-s"]);

function assignValue(parsed: ParsedLogsArguments, flag: string, value: string): void {
    switch (flag) {
        case "--session":
            parsed.session = value;
            break;
        case "--cursor":
            parsed.cursor = value;
            break;
        case "--project":
            parsed.project = value;
            break;
        case "--search":
        case "-s":
            parsed.search.push(value);
            break;
        case "--from":
            parsed.from = value;
            break;
        case "--to":
            parsed.to = value;
            break;
        case "--page-size":
            parsed.pageSize = value;
            break;
        default:
            throw new Error(`Unknown option: ${flag}. Run "co logs --help" for usage.`);
    }
}

/**
 * Parse `argv` after `co logs` ourselves: the shared cookbook parser loses the
 * ordering of `--flag value` pairs and cannot represent repeated `--search`.
 */
function parseArgs(raw: string[]): ParsedLogsArguments {
    const parsed: ParsedLogsArguments = { sessions: false, errors: false, ready: false, search: [], count: false, color: true, follow: false };

    for (let index = 0; index < raw.length; index++) {
        const token = raw[index];
        if (token === "-h" || token === "--help") continue; // handled by the global help branch
        if (token === "--sessions") {
            parsed.sessions = true;
            continue;
        }
        if (token === "-e" || token === "--errors") {
            parsed.errors = true;
            continue;
        }
        if (token === "--ready") {
            parsed.ready = true;
            continue;
        }
        if (token === "-f" || token === "--follow") {
            parsed.follow = true;
            continue;
        }
        if (token === "--count") {
            parsed.count = true;
            continue;
        }
        if (token === "--no-color") {
            parsed.color = false;
            continue;
        }

        if (token.startsWith("-") && token !== "-") {
            const equalsIndex = token.indexOf("=");
            const flag = equalsIndex >= 0 ? token.slice(0, equalsIndex) : token;
            if (!VALUE_FLAGS.has(flag)) throw new Error(`Unknown option: ${token}. Run "co logs --help" for usage.`);

            let value: string;
            if (equalsIndex >= 0) {
                value = token.slice(equalsIndex + 1);
            } else {
                const next = raw[index + 1];
                if (next === undefined || (next.startsWith("-") && next !== "-")) {
                    throw new Error(`Missing value for ${flag}. Use ${flag}=<value>.`);
                }
                value = next;
                index++;
            }
            if (value.length === 0) throw new Error(`Missing value for ${flag}. Use ${flag}=<value>.`);
            assignValue(parsed, flag, value);
            continue;
        }

        throw new Error(`Unexpected argument: ${token}. Run "co logs --help" for usage.`);
    }

    return parsed;
}

function assertCursorConflicts(parsed: ParsedLogsArguments): void {
    if (parsed.cursor === undefined) return;
    const conflicts: string[] = [];
    if (parsed.session !== undefined) conflicts.push("--session");
    if (parsed.errors) conflicts.push("--errors");
    if (parsed.ready) conflicts.push("--ready");
    if (parsed.project !== undefined) conflicts.push("--project");
    if (parsed.search.length > 0) conflicts.push("--search");
    if (parsed.from !== undefined) conflicts.push("--from");
    if (parsed.to !== undefined) conflicts.push("--to");
    if (parsed.pageSize !== undefined) conflicts.push("--page-size");
    if (parsed.follow) conflicts.push("--follow");
    if (conflicts.length > 0) {
        throw new Error(`The --cursor option already carries the session, filters and page size. Remove ${conflicts.join(", ")}.`);
    }
}

function buildFilters(parsed: ParsedLogsArguments): LogFilters {
    return {
        // --ready takes priority over -e: ready failures/timeouts stay visible.
        errorsOnly: parsed.errors && !parsed.ready,
        search: [...parsed.search],
        from: parsed.from !== undefined ? parseTimeBoundary(parsed.from, "from") : undefined,
        to: parsed.to !== undefined ? parseTimeBoundary(parsed.to, "to") : undefined,
        project: parsed.project,
        readyOnly: parsed.ready,
    };
}

function cursorSelection(sid: string): SessionSelection {
    const sessions = listSessions();
    if (sid === "all") return { sessions, kind: "all", label: `All sessions (${sessions.length})` };
    const summary = sessions.find((session) => session.meta.sessionId === sid);
    if (!summary) {
        throw new Error(`Session ${sid} is no longer available (it may have been removed by log retention). Run "co logs" to start again from the newest logs.`);
    }
    return { sessions: [summary], kind: "id", label: sessionLabel(summary) };
}

function printSessions(write: (text: string) => void, color: boolean): void {
    const sessions = listSessions();
    if (sessions.length === 0) {
        write(`No sessions found under ${getLogsRoot()}.\n`);
        return;
    }
    const limits = getRetentionLimits();
    const retention = {
        ...limits,
        totalBytes: sessions.reduce((sum, session) => sum + session.sizeBytes, 0),
        totalSessions: sessions.length,
    };
    write(renderSessionsList({ sessions, retention, logsRoot: getLogsRoot(), color }) + "\n");
}

async function runFollow(parsed: ParsedLogsArguments, color: boolean, write: (text: string) => void): Promise<void> {
    const current = readCurrentSession();
    if (!current) throw new Error(`Live follow requires a running session. Start one with "co start" or "co dev" first.`);

    const selection = resolveSessionSelection({ session: parsed.session });
    const session = selection.sessions[0];
    if (!session || session.meta.sessionId !== current.sessionId || !session.running) {
        throw new Error(`Live follow only works with the current running session (${current.sessionId}). Run "co logs --sessions" to inspect sessions.`);
    }

    const pageSize = parsed.pageSize !== undefined ? parsePageSize(parsed.pageSize) : DEFAULT_PAGE_SIZE;
    followSession({ session, filters: buildFilters(parsed), pageSize, color, write });
    // followSession keeps polling and exits the process on session end / Ctrl+C.
    await new Promise<void>(() => {});
}

export default await defineCookbookCommand(async (utils) => {
    try {
        const parsed = parseArgs(utils.getParams().raw);
        assertCursorConflicts(parsed);

        const color = parsed.color && Boolean(stdout.isTTY);
        const write = (text: string) => {
            stdout.write(text);
        };

        if (parsed.sessions) {
            printSessions(write, color);
            return;
        }

        if (parsed.follow) {
            await runFollow(parsed, color, write);
            return;
        }

        if (parsed.cursor !== undefined) {
            const cursor: CursorState = decodeCursor(parsed.cursor);
            renderPage({
                selection: cursorSelection(cursor.sid),
                filters: deserializeFilters(cursor.filters),
                after: cursor,
                pageSize: cursor.pageSize,
                count: parsed.count,
                write,
                color,
            });
            return;
        }

        const selection = resolveSessionSelection({ session: parsed.session });
        const pageSize = parsed.pageSize !== undefined ? parsePageSize(parsed.pageSize) : DEFAULT_PAGE_SIZE;
        renderPage({ selection, filters: buildFilters(parsed), pageSize, count: parsed.count, write, color });
    } catch (error: any) {
        utils.error(error?.message ?? String(error));
        exit(1);
    } finally {
        // Diagnostics only: proves that paging is O(1) in the size of the logs.
        if (process.env.COOKBOOK_LOG_MEMORY === "1") {
            const usage = process.memoryUsage();
            stdout.write(
                `[memory] rss=${(usage.rss / 1048576).toFixed(1)}MB heapUsed=${(usage.heapUsed / 1048576).toFixed(1)}MB external=${(usage.external / 1048576).toFixed(1)}MB\n`,
            );
        }
    }
});
