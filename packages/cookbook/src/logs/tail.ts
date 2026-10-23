import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getLogCollector } from "./collector";
import { getSessionDir } from "./session";
import type { LogRecord } from "./types";

/**
 * Incremental session log tail used by the foreground launchers (`co start`,
 * `co test`) while they wait for the background process.
 *
 * The background session directory is polled every 400 ms. New bytes are read
 * per segment file (offset map), parsed as JSONL and mirrored to the terminal
 * through the foreground collector (`writeTerminal`) so they are not captured
 * twice. Records originating from the foreground itself (`co:*` sources) are
 * skipped because they are already on the terminal, and `kind === "rotation"`
 * markers are ignored.
 */
export interface SessionLogTailOptions {
    sessionId: string;
    intervalMs?: number;
    /** Sources starting with any of these prefixes are not mirrored. */
    skipSourcePrefixes?: Array<string>;
    /** Sink for rendered lines (default: foreground collector / stdout). */
    write?: (text: string) => void;
}

const DEFAULT_SKIP_PREFIXES = ["co:"];
const DEFAULT_INTERVAL_MS = 400;

function defaultWrite(text: string): void {
    const collector = getLogCollector();
    if (collector) {
        collector.writeTerminal("stdout", text);
        return;
    }
    process.stdout.write(text);
}

/** Render one record as the plain text line shown in the terminal. */
export function formatTailRecord(record: LogRecord): string {
    if (record.source.startsWith("worker:")) return `[${record.source.slice("worker:".length)}] ${record.text}`;
    if (record.source === "cookbook" || record.source === "cookbook:boot") return record.text;
    return `[${record.source}] ${record.text}`;
}

export function startSessionLogTail(options: SessionLogTailOptions): () => void {
    const sessionId = options.sessionId;
    const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    const skipPrefixes = options.skipSourcePrefixes ?? DEFAULT_SKIP_PREFIXES;
    const write = options.write ?? defaultWrite;
    const dir = getSessionDir(sessionId);
    const offsets = new Map<string, number>();
    let stopped = false;

    const shouldMirror = (record: LogRecord): boolean => {
        if (record.kind === "rotation") return false;
        return !skipPrefixes.some((prefix) => record.source.startsWith(prefix));
    };

    const tick = (): void => {
        if (stopped) return;
        let names: Array<string>;
        try {
            names = readdirSync(dir).filter((name) => name.endsWith(".jsonl"));
        } catch {
            return;
        }

        const fresh: Array<LogRecord> = [];
        for (const name of names) {
            const path = join(dir, name);
            let size: number;
            try {
                size = statSync(path).size;
            } catch {
                continue;
            }
            let offset = offsets.get(path) ?? 0;
            if (size < offset) offset = 0; // file was replaced / truncated
            if (size === offset) {
                offsets.set(path, offset);
                continue;
            }

            let chunk: Buffer;
            try {
                chunk = readFileSync(path).subarray(offset);
            } catch {
                continue;
            }
            const lastNewline = chunk.lastIndexOf(0x0a);
            if (lastNewline < 0) {
                offsets.set(path, offset);
                continue;
            }
            const text = chunk.subarray(0, lastNewline + 1).toString("utf-8");
            offsets.set(path, offset + lastNewline + 1);
            for (const line of text.split("\n")) {
                if (!line) continue;
                try {
                    fresh.push(JSON.parse(line) as LogRecord);
                } catch {
                    // corrupt line (e.g. a torn write during a crash): skip it
                }
            }
        }

        if (fresh.length === 0) return;
        fresh.sort((first, second) => first.ts - second.ts);
        for (const record of fresh) {
            if (!shouldMirror(record)) continue;
            write(`${formatTailRecord(record)}\n`);
        }
    };

    tick();
    const timer = setInterval(tick, intervalMs);
    (timer as unknown as { unref?: () => void }).unref?.();

    return () => {
        stopped = true;
        clearInterval(timer);
    };
}
