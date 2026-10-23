import { closeSync, mkdirSync, openSync, readdirSync, statSync, writeFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import { stripAnsi } from "./ansi";
import { BOOTSTRAP_MAX_LINES, BOOTSTRAP_TAIL_BYTES, readBootstrapTail } from "./bootstrap";
import { isErrorText } from "./error-keywords";
import { LineSplitter } from "./line-splitter";
import { enforceRetention, finalizeSession, getSessionDir, readSessionMeta, updateSessionMeta, writeCurrentSession } from "./session";
import type { LogRecord, LogStream } from "./types";

/**
 * The unified log collector.
 *
 * One process owns one session writer: it appends JSONL records to
 * `<logsRoot>/sessions/<sessionId>/<pid>-<seq>.jsonl`, rotating a segment at
 * 512 KB and flushing buffered bytes at least every 50 ms (or immediately when
 * 256 KB have accumulated). Consoles and child process streams are captured
 * through it so that `co logs` can show everything in one place.
 *
 * Logging must never take the application down: every write is best-effort,
 * and a file-system failure disables file writing (with a single warning)
 * instead of throwing.
 */

const SEGMENT_ROTATE_BYTES = 512 * 1024;
const FLUSH_THRESHOLD_BYTES = 256 * 1024;
const FLUSH_INTERVAL_MS = 50;
const HEARTBEAT_INTERVAL_MS = 5000;
const MAX_EVENT_BYTES = 1024 * 1024;

const SIGNAL_NUMBERS: Record<"SIGHUP" | "SIGINT" | "SIGTERM", number> = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 };

// Captured before any console patch so that mirroring / warnings can never
// recurse back into the capture patch.
const realStdoutWrite = process.stdout.write.bind(process.stdout) as (...args: Array<any>) => boolean;
const realStderrWrite = process.stderr.write.bind(process.stderr) as (...args: Array<any>) => boolean;

export interface RecordExtra {
    kind?: string;
    meta?: Record<string, unknown>;
}

export interface SessionEventRecord {
    source: string;
    stream: LogStream;
    text: string;
    err?: boolean;
    kind?: string;
    meta?: Record<string, unknown>;
}

export interface InstallLogCollectorOptions {
    /** default source for captured console writes */
    source: string;
    /** default: env COOKBOOK_LOG_SESSION (bg children) else required for the foreground owner */
    sessionId?: string;
    /** patch process.stdout/stderr.write (default true) */
    captureConsole?: boolean;
    /** also forward captured writes to the real terminal (default true) */
    mirror?: boolean;
    /** import pre-collector output (default: env COOKBOOK_BOOTSTRAP_LOG) */
    bootstrapLogPath?: string;
    /** default true: on exit write session-end + finalize meta */
    finalizeOnExit?: boolean;
    /** default true: exit / uncaughtException / unhandledRejection / SIGINT / SIGTERM / SIGHUP */
    installProcessHooks?: boolean;
    /** default true: write the "session-start" system record on install */
    announceSessionStart?: boolean;
}

export interface LogCollector {
    readonly sessionId: string;
    record(source: string, stream: "stdout" | "stderr", chunk: string | Uint8Array, extra?: RecordExtra): void;
    event(source: string, level: "info" | "error", text: string, extra?: RecordExtra): void;
    /** bypass capture, write to the real terminal */
    writeTerminal(stream: "stdout" | "stderr", chunk: string): void;
    flushSync(): void;
    /** stop finalizing the session on exit (foreground start/test hand-off) */
    detachOwnership(): void;
    close(): void;
}

let activeCollector: LogCollectorImpl | undefined;

function formatError(error: unknown): string {
    if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
    if (typeof error === "string") return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

function segmentName(pid: number, seq: number): string {
    return `${pid}-${String(seq).padStart(6, "0")}.jsonl`;
}

/** Highest segment sequence number written by `pid` in `dir` (0 when none). */
function findMaxSeq(dir: string, pid: number): number {
    let max = 0;
    try {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isFile()) continue;
            const match = /^(\d+)-(\d+)\.jsonl$/.exec(entry.name);
            if (!match) continue;
            if (Number(match[1]) !== pid) continue;
            const seq = Number(match[2]);
            if (Number.isFinite(seq) && seq > max) max = seq;
        }
    } catch {
        // an unreadable directory simply means "no previous segments"
    }
    return max;
}

function truncateText(text: string, maxBytes: number): string {
    const bytes = Buffer.byteLength(text, "utf-8");
    if (bytes <= maxBytes) return text;
    let head = Buffer.from(text, "utf-8").subarray(0, maxBytes).toString("utf-8");
    if (head.endsWith("\uFFFD")) head = head.slice(0, -1);
    return `${head}\u2026 [line truncated, original ${bytes} bytes]`;
}

function singleLineText(text: string): string {
    return stripAnsi(text).replace(/\r\n?|\n/g, " ");
}

/**
 * Serialize one record. A hostile / circular `meta` payload must not disable
 * file logging for the whole process, so it is dropped as a fallback.
 */
function serializeRecord(record: LogRecord): string {
    try {
        return JSON.stringify(record);
    } catch {
        const { meta: _meta, ...rest } = record;
        try {
            return JSON.stringify({ ...rest, text: `${record.text} [meta omitted: not serializable]` });
        } catch {
            return JSON.stringify({ ts: record.ts, source: record.source, stream: record.stream, text: "[record not serializable]", err: true });
        }
    }
}

interface WriteExtra extends RecordExtra {
    err?: boolean;
}

/**
 * Append-only JSONL segment writer for one process. Records are batched in
 * memory and written with `fs.writeSync`, so `flushSync()` works inside a
 * process "exit" handler.
 */
class SegmentWriter {
    readonly sessionId: string;

    private seq: number;
    private fd: number | undefined;
    private currentPath = "";
    private currentSize = 0;
    private pending: Array<Buffer> = [];
    private pendingBytes = 0;
    private lastTs = 0;
    private lastHeartbeatAt = 0;
    private timer: ReturnType<typeof setInterval> | undefined;
    private disabled = false;
    private warned = false;
    private closed = false;

    constructor(sessionId: string) {
        this.sessionId = sessionId;
        const dir = getSessionDir(sessionId);
        try {
            mkdirSync(dir, { recursive: true });
        } catch (error) {
            this.disable(error);
            this.seq = 1;
            return;
        }
        this.seq = findMaxSeq(dir, process.pid) + 1;
        this.openSegment();
        this.timer = setInterval(() => {
            try {
                this.drain();
            } catch (error) {
                this.disable(error);
            }
        }, FLUSH_INTERVAL_MS);
        (this.timer as unknown as { unref?: () => void }).unref?.();
    }

    get path(): string {
        return this.currentPath;
    }

    /** Append one already-split line / event. */
    write(source: string, stream: LogStream, text: string, extra: WriteExtra = {}): void {
        if (this.disabled || this.closed) return;
        try {
            const ts = Math.max(this.lastTs, Date.now());
            this.lastTs = ts;
            const record: LogRecord = {
                ts,
                source,
                stream,
                text,
                err: extra.err ?? (stream === "stderr" || isErrorText(text)),
            };
            if (extra.kind !== undefined) record.kind = extra.kind;
            if (extra.meta !== undefined) record.meta = extra.meta;
            this.appendRecord(Buffer.from(`${serializeRecord(record)}\n`, "utf-8"));
            this.heartbeat();
        } catch (error) {
            this.disable(error);
        }
    }

    flushSync(): void {
        if (this.closed) return;
        try {
            this.drain();
        } catch (error) {
            this.disable(error);
        }
    }

    close(): void {
        if (this.closed) return;
        try {
            this.drain();
        } catch {
            // ignore
        }
        this.closed = true;
        if (this.timer !== undefined) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        this.closeFd();
    }

    private appendRecord(encoded: Buffer): void {
        const buffered = this.currentSize + this.pendingBytes;
        if (buffered > 0 && buffered + encoded.length > SEGMENT_ROTATE_BYTES) {
            this.drain();
            if (this.currentSize > 0) this.rotate();
        }
        this.pending.push(encoded);
        this.pendingBytes += encoded.length;
        if (this.pendingBytes >= FLUSH_THRESHOLD_BYTES) this.drain();
    }

    private drain(): void {
        if (this.pending.length === 0) return;
        const buffer = this.pending.length === 1 ? this.pending[0] : Buffer.concat(this.pending, this.pendingBytes);
        const length = buffer.length;
        this.pending = [];
        this.pendingBytes = 0;
        const fd = this.fd;
        if (fd === undefined) return;

        let written = 0;
        while (written < length) {
            const count = writeSync(fd, buffer, written, length - written);
            if (count <= 0) break;
            written += count;
        }
        this.currentSize += written;
    }

    private rotate(): void {
        this.drain();
        this.closeFd();
        if (this.disabled) return;
        const nextSeq = this.seq + 1;
        const nextPath = join(getSessionDir(this.sessionId), segmentName(process.pid, nextSeq));
        try {
            enforceRetention({ activeFile: nextPath });
        } catch {
            // retention is best effort
        }
        this.seq = nextSeq;
        this.openSegment();
    }

    private openSegment(): void {
        const dir = getSessionDir(this.sessionId);
        const path = join(dir, segmentName(process.pid, this.seq));
        try {
            const fd = openSync(path, "a");
            this.fd = fd;
            this.currentPath = path;
            try {
                this.currentSize = statSync(path).size;
            } catch {
                this.currentSize = 0;
            }
        } catch (error) {
            this.disable(error);
        }
    }

    private closeFd(): void {
        if (this.fd === undefined) return;
        try {
            closeSync(this.fd);
        } catch {
            // ignore
        }
        this.fd = undefined;
    }

    private heartbeat(): void {
        const now = Date.now();
        if (now - this.lastHeartbeatAt < HEARTBEAT_INTERVAL_MS) return;
        this.lastHeartbeatAt = now;
        try {
            updateSessionMeta(this.sessionId, { lastWriteAt: now });
        } catch {
            // metadata is advisory
        }
    }

    private disable(error: unknown): void {
        if (this.disabled) return;
        this.disabled = true;
        this.pending = [];
        this.pendingBytes = 0;
        this.closeFd();
        if (this.timer !== undefined) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        if (this.warned) return;
        this.warned = true;
        try {
            realStderrWrite(`[cookbook] failed to write session logs; file logging disabled: ${formatError(error)}\n`);
        } catch {
            // nothing else we can do
        }
    }
}

interface SplitterEntry {
    splitter: LineSplitter;
    source: string;
    stream: "stdout" | "stderr";
    extra: RecordExtra | undefined;
}

class LogCollectorImpl implements LogCollector {
    readonly sessionId: string;

    private readonly writer: SegmentWriter;
    private readonly defaultSource: string;
    private readonly mirrorConsole: boolean;
    private readonly captureConsole: boolean;
    private readonly finalizeOnExit: boolean;
    private readonly shouldInstallHooks: boolean;
    private readonly announceSessionStart: boolean;
    private readonly bootstrapLogPath: string | undefined;
    private readonly splitters = new Map<string, SplitterEntry>();
    private readonly processHooks: Array<{ event: string | NodeJS.Signals; handler: (...args: Array<any>) => void }> = [];

    private ownsSession: boolean;
    private closed = false;
    private exitHandled = false;
    private consolePatched = false;

    constructor(options: InstallLogCollectorOptions, sessionId: string) {
        this.sessionId = sessionId;
        this.defaultSource = options.source;
        this.mirrorConsole = options.mirror ?? true;
        this.captureConsole = options.captureConsole ?? true;
        this.finalizeOnExit = options.finalizeOnExit ?? true;
        this.shouldInstallHooks = options.installProcessHooks ?? true;
        this.announceSessionStart = options.announceSessionStart ?? true;
        this.bootstrapLogPath = options.bootstrapLogPath ?? process.env.COOKBOOK_BOOTSTRAP_LOG;
        this.ownsSession = this.finalizeOnExit;
        this.writer = new SegmentWriter(sessionId);
    }

    start(): void {
        const meta = readSessionMeta(this.sessionId);
        try {
            updateSessionMeta(this.sessionId, { pid: process.pid, lastWriteAt: Date.now() });
            writeCurrentSession({ sessionId: this.sessionId, startedAt: meta.startedAt, pid: process.pid, mode: meta.mode });
        } catch {
            // the session pointer is advisory; file logging keeps working
        }

        this.importBootstrap();

        // foreground launchers use a "co:*" source for this event so that the
        // session log tail (used by "co start" / "co test") does not mirror it
        // a second time; background children use "cookbook".
        // Short-lived commands that only attach to an existing session (co stop)
        // skip the event so the timeline does not pretend a run started.
        if (this.announceSessionStart) {
            this.writer.write(this.defaultSource, "system", `session started (pid ${process.pid}${meta.mode ? `, mode ${meta.mode}` : ""})`, {
                kind: "session-start",
                err: false,
                meta: { pid: process.pid, sessionId: this.sessionId, mode: meta.mode },
            });
        }

        if (this.captureConsole) this.patchConsole();
        if (this.shouldInstallHooks) this.installProcessHooks();
    }

    record(source: string, stream: "stdout" | "stderr", chunk: string | Uint8Array, extra?: RecordExtra): void {
        if (this.closed) return;
        try {
            if (typeof chunk === "string" ? chunk.length === 0 : chunk.byteLength === 0) return;
            const key = `${stream}\u0000${source}`;
            let entry = this.splitters.get(key);
            if (!entry) {
                entry = { splitter: new LineSplitter(), source, stream, extra };
                this.splitters.set(key, entry);
            }
            const captured = entry;
            captured.splitter.push(chunk, (line) => this.writer.write(captured.source, captured.stream, line, captured.extra));
        } catch {
            // never let log capture break the application
        }
    }

    event(source: string, level: "info" | "error", text: string, extra?: RecordExtra): void {
        if (this.closed) return;
        try {
            const clean = truncateText(singleLineText(text), MAX_EVENT_BYTES);
            this.writer.write(source, "system", clean, { kind: extra?.kind, meta: extra?.meta, err: level === "error" });
        } catch {
            // ignore
        }
    }

    writeTerminal(stream: "stdout" | "stderr", chunk: string): void {
        try {
            // Background processes have no terminal: their real stdout/stderr are
            // the bootstrap log file. Mirroring there would duplicate every line
            // on disk (and grow the file unbounded), so mirroring is opt-in via
            // the `mirror` install option.
            if (!this.mirrorConsole) return;
            if (stream === "stdout") realStdoutWrite(chunk);
            else realStderrWrite(chunk);
        } catch {
            // ignore
        }
    }

    flushSync(): void {
        if (this.closed) return;
        try {
            for (const entry of this.splitters.values()) {
                entry.splitter.flush((line) => this.writer.write(entry.source, entry.stream, line, entry.extra));
            }
            this.writer.flushSync();
        } catch {
            // ignore
        }
    }

    detachOwnership(): void {
        this.ownsSession = false;
    }

    close(): void {
        if (this.closed) return;
        try {
            this.flushSync();
        } catch {
            // ignore
        }
        this.closed = true;
        this.writer.close();
        this.restoreConsole();
        this.removeProcessHooks();
        if (activeCollector === this) activeCollector = undefined;
    }

    private importBootstrap(): void {
        const path = this.bootstrapLogPath;
        if (!path) return;
        try {
            const lines = readBootstrapTail(path, { maxBytes: BOOTSTRAP_TAIL_BYTES, maxLines: BOOTSTRAP_MAX_LINES });
            if (lines.length === 0) return;
            const splitter = new LineSplitter();
            const emit = (line: string) => this.writer.write("cookbook:boot", "stdout", line, { kind: "boot-import" });
            splitter.push(`${lines.join("\n")}\n`, emit);
            splitter.flush(emit);
        } catch {
            // a missing / unreadable bootstrap log is normal
        }
    }

    private patchConsole(): void {
        try {
            (process.stdout as any).write = (chunk: unknown, ...args: Array<any>) => {
                this.captureConsoleChunk("stdout", chunk);
                if (this.mirrorConsole) return (realStdoutWrite as any)(chunk, ...args);
                return true;
            };
            (process.stderr as any).write = (chunk: unknown, ...args: Array<any>) => {
                this.captureConsoleChunk("stderr", chunk);
                if (this.mirrorConsole) return (realStderrWrite as any)(chunk, ...args);
                return true;
            };
            this.consolePatched = true;
        } catch {
            this.consolePatched = false;
        }
    }

    private captureConsoleChunk(stream: "stdout" | "stderr", chunk: unknown): void {
        if (this.closed) return;
        try {
            if (typeof chunk === "string") {
                this.record(this.defaultSource, stream, chunk);
                return;
            }
            if (chunk instanceof Uint8Array) {
                this.record(this.defaultSource, stream, chunk);
                return;
            }
            if (chunk === undefined || chunk === null) return;
            this.record(this.defaultSource, stream, String(chunk));
        } catch {
            // ignore
        }
    }

    private restoreConsole(): void {
        if (!this.consolePatched) return;
        this.consolePatched = false;
        try {
            (process.stdout as any).write = realStdoutWrite;
            (process.stderr as any).write = realStderrWrite;
        } catch {
            // ignore
        }
    }

    private installProcessHooks(): void {
        const add = (event: string | NodeJS.Signals, handler: (...args: Array<any>) => void) => {
            const wrapped = (...args: Array<any>) => handler(...args);
            try {
                process.on(event as any, wrapped);
                this.processHooks.push({ event, handler: wrapped });
            } catch {
                // ignore unsupported signals on this platform
            }
        };
        add("exit", (code?: number) => this.handleProcessExit(typeof code === "number" ? code : 0));
        add("uncaughtException", (error: unknown) => this.handleCrash("uncaughtException", error));
        add("unhandledRejection", (reason: unknown) => this.handleCrash("unhandledRejection", reason));
        add("SIGHUP", () => this.handleSignal("SIGHUP"));
        add("SIGINT", () => this.handleSignal("SIGINT"));
        add("SIGTERM", () => this.handleSignal("SIGTERM"));
    }

    private removeProcessHooks(): void {
        for (const { event, handler } of this.processHooks) {
            try {
                process.removeListener(event as any, handler);
            } catch {
                // ignore
            }
        }
        this.processHooks.length = 0;
    }

    private handleProcessExit(code: number): void {
        if (this.exitHandled) return;
        this.exitHandled = true;
        try {
            this.flushSync();
        } catch {
            // ignore
        }
        if (!this.ownsSession || this.closed) return;
        try {
            this.writer.write("cookbook", "system", `session ended (exit code ${code})`, { kind: "session-end", err: code !== 0, meta: { exitCode: code } });
            this.writer.flushSync();
            finalizeSession(this.sessionId, code === 0 ? "ended" : "failed", undefined, code);
        } catch {
            // ignore
        }
    }

    private handleCrash(kind: "uncaughtException" | "unhandledRejection", error: unknown): void {
        if (this.exitHandled) {
            process.exit(1);
            return;
        }
        this.exitHandled = true;
        try {
            const message = kind === "uncaughtException" ? formatError(error) : `Unhandled rejection: ${formatError(error)}`;
            this.record("cookbook", "stderr", message, { kind });
            this.flushSync();
            if (this.ownsSession) {
                this.writer.write("cookbook", "system", `session crashed (${kind})`, { kind: "session-end", err: true, meta: { status: "crashed" } });
                this.writer.flushSync();
                finalizeSession(this.sessionId, "crashed", kind);
            }
        } catch {
            // still exit with the crash semantics below
        }
        process.exit(1);
    }

    private handleSignal(signal: "SIGHUP" | "SIGINT" | "SIGTERM"): void {
        const exitCode = 128 + SIGNAL_NUMBERS[signal];
        if (this.exitHandled) {
            process.exit(exitCode);
            return;
        }
        this.exitHandled = true;
        try {
            this.writer.write("cookbook", "system", `received ${signal}, shutting down`, { kind: "signal", err: false, meta: { signal } });
            this.flushSync();
            if (this.ownsSession) {
                this.writer.write("cookbook", "system", `session ended (signal ${signal})`, { kind: "session-end", err: false, meta: { signal } });
                this.writer.flushSync();
                finalizeSession(this.sessionId, "ended", signal);
            }
        } catch {
            // ignore
        }
        process.exit(exitCode);
    }
}

/**
 * Install the process-wide collector.
 *
 * The session id defaults to `COOKBOOK_LOG_SESSION` (set by a foreground
 * launcher for its background child); a foreground command must create the
 * session first and pass it explicitly.
 */
export function installLogCollector(options: InstallLogCollectorOptions): LogCollector {
    const sessionId = options.sessionId ?? process.env.COOKBOOK_LOG_SESSION;
    if (!sessionId) {
        throw new Error(`Cannot install the log collector without a session id. Create a session first or set COOKBOOK_LOG_SESSION.`);
    }
    if (activeCollector) {
        try {
            activeCollector.close();
        } catch {
            // ignore
        }
        activeCollector = undefined;
    }
    const collector = new LogCollectorImpl(options, sessionId);
    activeCollector = collector;
    collector.start();
    return collector;
}

export function getLogCollector(): LogCollector | undefined {
    return activeCollector;
}

/**
 * One-shot writer for a *different* session (e.g. `co start` marking the
 * previous run as replaced). Writes one record to its own segment file and
 * closes it synchronously.
 */
export function writeSessionEvent(sessionId: string, record: SessionEventRecord): void {
    if (!sessionId) return;
    try {
        const dir = getSessionDir(sessionId);
        mkdirSync(dir, { recursive: true });
        const seq = findMaxSeq(dir, process.pid) + 1;
        const text = truncateText(singleLineText(record.text), MAX_EVENT_BYTES);
        const full: LogRecord = {
            ts: Date.now(),
            source: record.source,
            stream: record.stream,
            text,
            err: record.err ?? (record.stream === "stderr" || isErrorText(text)),
        };
        if (record.kind !== undefined) full.kind = record.kind;
        if (record.meta !== undefined) full.meta = record.meta;
        writeFileSync(join(dir, segmentName(process.pid, seq)), `${JSON.stringify(full)}\n`, { encoding: "utf-8", flag: "a" });
    } catch {
        // logging must never break the command that triggered it
    }
}
