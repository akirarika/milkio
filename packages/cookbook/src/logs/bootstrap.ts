import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";

/**
 * The background child is spawned with its stdout/stderr redirected to a plain
 * text file ("bootstrap" log) so that output produced *before* the log
 * collector is installed is not lost. Once the collector is up it imports the
 * tail of that file into the session.
 *
 * Import rules (see the design document): at most the last 1 MB and at most
 * the last 2000 lines. The failure path of `co start` / `co test` uses the
 * same helper with a much smaller line cap to print the reason a background
 * process died before it could log anything.
 */
export const BOOTSTRAP_TAIL_BYTES = 1024 * 1024;
export const BOOTSTRAP_MAX_LINES = 2000;

export interface BootstrapTailOptions {
    maxBytes?: number;
    maxLines?: number;
}

/**
 * Read the last `maxBytes` of a text file synchronously.
 *
 * When only a tail is read, the first (possibly partial) line is dropped.
 * Returns `undefined` when the file does not exist / cannot be read.
 */
export function readFileTail(path: string, maxBytes = BOOTSTRAP_TAIL_BYTES): string | undefined {
    let fd: number | undefined;
    try {
        if (!existsSync(path)) return undefined;
        const stat = statSync(path);
        if (!stat.isFile() || stat.size === 0) return undefined;

        const length = Math.min(stat.size, Math.max(1, Math.floor(maxBytes)));
        const start = stat.size - length;
        fd = openSync(path, "r");
        const buffer = Buffer.allocUnsafe(length);
        let read = 0;
        while (read < length) {
            const bytesRead = readSync(fd, buffer, read, length - read, start + read);
            if (bytesRead <= 0) break;
            read += bytesRead;
        }
        let text = buffer.subarray(0, read).toString("utf-8");
        if (start > 0) {
            // drop the (probably truncated) first line of the tail window
            const newline = text.indexOf("\n");
            text = newline >= 0 ? text.slice(newline + 1) : "";
        }
        return text;
    } catch {
        return undefined;
    } finally {
        if (fd !== undefined) {
            try {
                closeSync(fd);
            } catch {
                // ignore
            }
        }
    }
}

/** Split tail text into lines, keeping at most the newest `maxLines`. */
export function tailLines(text: string | undefined, maxLines: number): Array<string> {
    if (!text) return [];
    const lines = text.split(/\r?\n/);
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    if (maxLines > 0 && lines.length > maxLines) return lines.slice(-maxLines);
    return lines;
}

/** Read at most `maxLines` lines from the tail of the bootstrap log. */
export function readBootstrapTail(path: string | undefined, options: BootstrapTailOptions = {}): Array<string> {
    if (!path) return [];
    return tailLines(readFileTail(path, options.maxBytes ?? BOOTSTRAP_TAIL_BYTES), options.maxLines ?? BOOTSTRAP_MAX_LINES);
}
