import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { cwd } from "node:process";
import { __VERSION__ } from "../../__VERSION__";
import type { SessionMeta, SessionStatus, SessionSummary } from "./types";

/**
 * Sessions are the unit of "one run" (one `co start` / `co dev` / `co test`).
 * Logs are never cleared globally: every run gets its own directory under
 * "node_modules/.cookbook/logs/sessions/<sessionId>" and `co logs` defaults to
 * the currently running session (or the most recent one when nothing runs).
 *
 * `logs/current.json` points at the session that is considered "current".
 */
const SESSION_STATUSES = new Set<SessionStatus>(["running", "ended", "crashed", "failed", "replaced", "legacy", "unknown"]);

let logsRootOverride: string | undefined;
let lastRetentionAt = 0;

/** Test hook: redirect the logs root to a temporary directory. */
export function setLogsRoot(root: string | undefined): void {
    logsRootOverride = root;
    lastRetentionAt = 0;
}

export function getLogsRoot(): string {
    return logsRootOverride ?? join(cwd(), "node_modules", ".cookbook", "logs");
}

export function getSessionsDir(): string {
    return join(getLogsRoot(), "sessions");
}

export function getSessionDir(sessionId: string): string {
    return join(getSessionsDir(), sessionId);
}

export function getSessionMetaPath(sessionId: string): string {
    return join(getSessionDir(sessionId), "meta.json");
}

export function getCurrentPointerPath(): string {
    return join(getLogsRoot(), "current.json");
}

function isPidAlive(pid: number): boolean {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (error: any) {
        return error?.code === "EPERM";
    }
}

function readJsonFile<T>(path: string): T | undefined {
    try {
        const parsed = JSON.parse(readFileSync(path, "utf-8"));
        return parsed as T;
    } catch {
        return undefined;
    }
}

function writeJsonAtomic(path: string, value: unknown): void {
    mkdirSync(dirname(path), { recursive: true });
    const tmpPath = `${path}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
    try {
        writeFileSync(tmpPath, JSON.stringify(value, null, 2), "utf-8");
        renameSync(tmpPath, path);
    } catch {
        try {
            writeFileSync(path, JSON.stringify(value, null, 2), "utf-8");
        } catch {
            // logging must never take the application down
        }
    } finally {
        // A failed rename (e.g. Windows lock) must not leave stray tmp files in
        // the session directory.
        try {
            rmSync(tmpPath, { force: true });
        } catch {
            // ignore
        }
    }
}

function startedAtFromSessionId(sessionId: string): number | undefined {
    const base = Number(sessionId.split("-")[0]);
    return Number.isFinite(base) && base > 0 ? base : undefined;
}

function normalizeStatus(value: unknown): SessionStatus {
    return SESSION_STATUSES.has(value as SessionStatus) ? (value as SessionStatus) : "unknown";
}

function normalizeMeta(sessionId: string, parsed: any): SessionMeta {
    const startedAt = typeof parsed?.startedAt === "number" && Number.isFinite(parsed.startedAt) ? parsed.startedAt : (startedAtFromSessionId(sessionId) ?? 0);
    return {
        sessionId,
        startedAt,
        endedAt: typeof parsed?.endedAt === "number" ? parsed.endedAt : undefined,
        status: normalizeStatus(parsed?.status),
        mode: typeof parsed?.mode === "string" ? parsed.mode : undefined,
        pid: typeof parsed?.pid === "number" ? parsed.pid : undefined,
        cwd: typeof parsed?.cwd === "string" ? parsed.cwd : undefined,
        note: typeof parsed?.note === "string" ? parsed.note : undefined,
        exitCode: typeof parsed?.exitCode === "number" || parsed?.exitCode === null ? parsed.exitCode : undefined,
        version: typeof parsed?.version === "string" ? parsed.version : undefined,
        lastWriteAt: typeof parsed?.lastWriteAt === "number" ? parsed.lastWriteAt : undefined,
    };
}

export function readSessionMeta(sessionId: string): SessionMeta {
    const parsed = readJsonFile<any>(getSessionMetaPath(sessionId));
    if (parsed && parsed.sessionId === sessionId) return normalizeMeta(sessionId, parsed);
    return {
        sessionId,
        startedAt: startedAtFromSessionId(sessionId) ?? 0,
        status: "unknown",
    };
}

export function updateSessionMeta(sessionId: string, patch: Partial<SessionMeta>): SessionMeta {
    const meta = { ...readSessionMeta(sessionId), ...patch, sessionId };
    writeJsonAtomic(getSessionMetaPath(sessionId), meta);
    return meta;
}

export interface CurrentSession {
    sessionId: string;
    pid: number;
    startedAt: number;
    mode?: string;
}

export function readCurrentSession(): CurrentSession | undefined {
    const parsed = readJsonFile<any>(getCurrentPointerPath());
    if (typeof parsed?.sessionId !== "string" || typeof parsed?.pid !== "number" || typeof parsed?.startedAt !== "number") return undefined;
    return {
        sessionId: parsed.sessionId,
        pid: parsed.pid,
        startedAt: parsed.startedAt,
        mode: typeof parsed.mode === "string" ? parsed.mode : undefined,
    };
}

export function writeCurrentSession(meta: Pick<SessionMeta, "sessionId" | "startedAt"> & { pid?: number; mode?: string }): void {
    writeJsonAtomic(getCurrentPointerPath(), {
        sessionId: meta.sessionId,
        pid: meta.pid ?? process.pid,
        startedAt: meta.startedAt,
        mode: meta.mode,
    });
}

export function clearCurrentSession(sessionId?: string): void {
    if (sessionId !== undefined) {
        const current = readCurrentSession();
        if (current && current.sessionId !== sessionId) return;
    }
    try {
        rmSync(getCurrentPointerPath(), { force: true });
    } catch {
        // ignore
    }
}

function cleanupLegacyFlatLogs(): void {
    const root = getLogsRoot();
    if (!existsSync(root)) return;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        if (!/^\d+(-\d+)?\.log$/.test(entry.name)) continue;
        try {
            rmSync(join(root, entry.name), { force: true });
        } catch {
            // ignore
        }
    }
}

export function createSession(options: { mode?: string; sessionId?: string } = {}): SessionMeta {
    mkdirSync(getSessionsDir(), { recursive: true });
    cleanupLegacyFlatLogs();

    const base = options.sessionId ?? String(Date.now());
    let sessionId = base;
    let suffix = 1;
    while (existsSync(getSessionDir(sessionId))) sessionId = `${base}-${suffix++}`;
    mkdirSync(getSessionDir(sessionId), { recursive: true });

    const meta: SessionMeta = {
        sessionId,
        startedAt: startedAtFromSessionId(sessionId) ?? Date.now(),
        status: "running",
        mode: options.mode,
        pid: process.pid,
        cwd: cwd(),
        version: __VERSION__,
        lastWriteAt: Date.now(),
    };
    writeJsonAtomic(getSessionMetaPath(sessionId), meta);
    writeCurrentSession(meta);
    enforceRetention({ force: true });
    return meta;
}

export function finalizeSession(sessionId: string, status: SessionStatus, note?: string, exitCode?: number | null): void {
    const meta = updateSessionMeta(sessionId, {
        status,
        note,
        endedAt: Date.now(),
        exitCode,
        lastWriteAt: Date.now(),
    });
    clearCurrentSession(meta.sessionId);
}

export interface SessionSelection {
    sessions: Array<SessionSummary>;
    kind: "current" | "last" | "index" | "id" | "all";
    label: string;
}

export function sessionLabel(summary: SessionSummary): string {
    return `Session #${summary.index}${summary.running ? " (running)" : ""}`;
}

export function listSessions(): Array<SessionSummary> {
    const sessionsDir = getSessionsDir();
    if (!existsSync(sessionsDir)) return [];
    const current = readCurrentSession();
    const currentAlive = current !== undefined && isPidAlive(current.pid);
    const summaries: Array<SessionSummary> = [];

    for (const entry of readdirSync(sessionsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const sessionId = entry.name;
        const dir = join(sessionsDir, sessionId);
        const meta = readSessionMeta(sessionId);
        let sizeBytes = 0;
        let segmentCount = 0;
        try {
            for (const file of readdirSync(dir, { withFileTypes: true })) {
                if (!file.isFile()) continue;
                try {
                    sizeBytes += statSync(join(dir, file.name)).size;
                } catch {
                    // file disappeared; ignore
                }
                if (file.name.endsWith(".jsonl")) segmentCount++;
            }
        } catch {
            // directory disappeared; still list the metadata
        }
        const running = current?.sessionId === sessionId && currentAlive;
        if (running) meta.status = "running";
        else if (meta.status === "running") meta.status = "crashed";
        summaries.push({ meta, dir, sizeBytes, segmentCount, running, index: 0 });
    }

    summaries.sort((a, b) => b.meta.startedAt - a.meta.startedAt || b.meta.sessionId.localeCompare(a.meta.sessionId));
    summaries.forEach((summary, index) => {
        summary.index = index + 1;
    });
    return summaries;
}

/**
 * Cheap "is this session still running?" check (pointer + pid only). Unlike
 * `listSessions()` it never stats session directories, so the live follow loop
 * can call it every tick.
 */
export function isSessionRunning(sessionId: string): boolean {
    const current = readCurrentSession();
    return current?.sessionId === sessionId && isPidAlive(current.pid);
}

export function resolveSessionSelection(options: { session?: string } = {}): SessionSelection {    const sessions = listSessions();
    if (sessions.length === 0) {
        throw new Error(`No logs found in ${getLogsRoot()}. Run "co start" or "co dev" first.`);
    }
    const current = readCurrentSession();
    const running = current && isPidAlive(current.pid) ? sessions.find((summary) => summary.meta.sessionId === current.sessionId) : undefined;

    if (options.session === undefined) {
        if (running) return { sessions: [running], kind: "current", label: sessionLabel(running) };
        return { sessions: [sessions[0]], kind: "last", label: sessionLabel(sessions[0]) };
    }

    if (options.session === "all") {
        return { sessions, kind: "all", label: `All sessions (${sessions.length})` };
    }

    // A short numeric value is a 1-based index; a long numeric value is a
    // session-id prefix (session ids are millisecond timestamps).
    const indexCandidate = /^\d{1,6}$/.test(options.session);
    if (indexCandidate) {
        const numeric = Number(options.session);
        if (numeric < 1 || numeric > sessions.length) {
            throw new Error(`Session #${numeric} does not exist. Available: #1..#${sessions.length}. Run "co logs --sessions" to list them.`);
        }
        return { sessions: [sessions[numeric - 1]], kind: "index", label: sessionLabel(sessions[numeric - 1]) };
    }

    const matches = sessions.filter((summary) => summary.meta.sessionId.startsWith(options.session as string));
    if (matches.length === 0) {
        throw new Error(`Session "${options.session}" does not exist. Run "co logs --sessions" to list them.`);
    }
    if (matches.length > 1) {
        throw new Error(`Session "${options.session}" is ambiguous (${matches.map((match) => match.meta.sessionId).join(", ")}).`);
    }
    return { sessions: [matches[0]], kind: "id", label: sessionLabel(matches[0]) };
}

function envInt(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

interface SessionFile {
    name: string;
    path: string;
    size: number;
    mtimeMs: number;
}

function listSessionFiles(dir: string): Array<SessionFile> {
    const files: Array<SessionFile> = [];
    try {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isFile()) continue;
            const path = join(dir, entry.name);
            try {
                const stat = statSync(path);
                files.push({ name: entry.name, path, size: stat.size, mtimeMs: stat.mtimeMs });
            } catch {
                // ignore
            }
        }
    } catch {
        // ignore
    }
    return files;
}

function trimSessionSegments(dir: string, maxBytes: number, activeFile?: string): void {
    const files = listSessionFiles(dir)
        .filter((file) => file.name.endsWith(".jsonl"))
        .sort((a, b) => a.mtimeMs - b.mtimeMs);
    let total = files.reduce((sum, file) => sum + file.size, 0);
    const now = Date.now();
    for (const file of files) {
        if (total <= maxBytes) break;
        if (file.path === activeFile || file.name === activeFile) continue;
        if (now - file.mtimeMs < 2000) continue;
        try {
            rmSync(file.path, { force: true });
            total -= file.size;
        } catch {
            // ignore
        }
    }
}

/**
 * Evict old sessions / segments so logs cannot grow without bound.
 *
 * Defaults (override with env vars):
 *   COOKBOOK_LOG_MAX_BYTES         256 MB total
 *   COOKBOOK_LOG_MAX_SESSIONS      20 sessions
 *   COOKBOOK_LOG_MAX_SESSION_BYTES 128 MB for the current session
 */
export function enforceRetention(options: { force?: boolean; activeFile?: string } = {}): void {
    const now = Date.now();
    if (!options.force && now - lastRetentionAt < 5000) return;
    lastRetentionAt = now;

    const maxBytes = envInt("COOKBOOK_LOG_MAX_BYTES", 256 * 1024 * 1024);
    const maxSessions = envInt("COOKBOOK_LOG_MAX_SESSIONS", 20);
    const maxSessionBytes = envInt("COOKBOOK_LOG_MAX_SESSION_BYTES", 128 * 1024 * 1024);

    const current = readCurrentSession();
    const sessions = listSessions();
    let total = sessions.reduce((sum, summary) => sum + summary.sizeBytes, 0);

    for (let index = sessions.length - 1; index >= 0 && (total > maxBytes || sessions.length > maxSessions); index--) {
        const session = sessions[index];
        if (session.running || session.meta.sessionId === current?.sessionId) continue;
        try {
            rmSync(session.dir, { recursive: true, force: true });
            total -= session.sizeBytes;
            sessions.splice(index, 1);
        } catch {
            // ignore (locked on Windows, etc.)
        }
    }

    const currentSummary = current ? sessions.find((summary) => summary.meta.sessionId === current.sessionId) : undefined;
    if (currentSummary && currentSummary.sizeBytes > maxSessionBytes) {
        trimSessionSegments(currentSummary.dir, maxSessionBytes, options.activeFile);
    }
}

export function getRetentionLimits(): { maxBytes: number; maxSessions: number; maxSessionBytes: number } {
    return {
        maxBytes: envInt("COOKBOOK_LOG_MAX_BYTES", 256 * 1024 * 1024),
        maxSessions: envInt("COOKBOOK_LOG_MAX_SESSIONS", 20),
        maxSessionBytes: envInt("COOKBOOK_LOG_MAX_SESSION_BYTES", 128 * 1024 * 1024),
    };
}
