import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { stdout } from "node:process";
import { getLogsDir } from "./background";

/**
 * Tails the newest background log file and mirrors fresh content to stdout.
 *
 * Used by "co start" (and any command that waits on the background dev
 * server): while the readiness health-checks are still running, the
 * background process' output is shown in the terminal in addition to being
 * written to the log files. Once the server is ready (or the wait fails),
 * the caller stops the tail and the background process keeps writing to
 * log files only.
 *
 * Progress spinner frames ("◐ [12.3%] cookbook is starting..") are filtered
 * out so only meaningful log lines reach the terminal.
 */
export function startLogTail(options: { intervalMs?: number } = {}): () => void {
    const logsDir = getLogsDir();
    const intervalMs = options.intervalMs ?? 400;
    let current: string | undefined;
    let offset = 0;
    let stopped = false;

    const newestFile = async (): Promise<string | undefined> => {
        try {
            const entries = await readdir(logsDir);
            const files = entries.filter((name) => /^\d+(-\d+)?\.log$/.test(name));
            if (files.length === 0) return undefined;
            files.sort((a, b) => {
                const timestampA = Number(a.split(".log")[0].split("-")[0]);
                const timestampB = Number(b.split(".log")[0].split("-")[0]);
                if (timestampA !== timestampB) return timestampA - timestampB;
                return a.localeCompare(b);
            });
            return files[files.length - 1];
        } catch {
            return undefined;
        }
    };

    const drain = async (file: string, fromOffset: number): Promise<number> => {
        let buffer: Buffer;
        try {
            buffer = await readFile(join(logsDir, file));
        } catch {
            return fromOffset;
        }
        if (buffer.length < fromOffset) fromOffset = 0; // file was cleared / replaced
        if (buffer.length <= fromOffset) return fromOffset;
        // only consume whole lines; keep the trailing partial line for the next tick
        const chunk = buffer.subarray(fromOffset).toString("utf-8");
        const lastNewline = chunk.lastIndexOf("\n");
        if (lastNewline < 0) return fromOffset;
        const complete = chunk.slice(0, lastNewline + 1);
        const filtered = complete
            .split("\n")
            .filter((line) => !line.includes("cookbook is starting.."))
            .join("\n");
        if (filtered.trim()) stdout.write(filtered);
        return fromOffset + Buffer.byteLength(complete, "utf-8");
    };

    const tick = async () => {
        if (stopped) return;
        const newest = await newestFile();
        if (!newest) return;
        if (current === undefined) {
            current = newest;
            offset = 0;
        } else if (newest !== current) {
            // rotation or a fresh start: finish the old file, then follow the new one
            offset = await drain(current, offset);
            current = newest;
            offset = 0;
        }
        offset = await drain(current, offset);
    };

    const timer = setInterval(() => {
        void tick();
    }, intervalMs);
    void tick();

    return () => {
        stopped = true;
        clearInterval(timer);
    };
}
