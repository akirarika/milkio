import { stripAnsi as stripAnsiCodes } from "./ansi";

/**
 * Hard cap for a single log line, in UTF-8 bytes. A line that grows beyond
 * this is truncated (the collector appends a marker with the original size)
 * so a pathological child process cannot balloon a segment file.
 */
export const MAX_LINE_BYTES = 1024 * 1024;

export type LineSink = (line: string) => void;

export interface LineSplitterOptions {
    /** Hard cap for one line, in UTF-8 bytes (default 1 MB). */
    maxLineBytes?: number;
    /** Strip ANSI escape sequences when a line is emitted (default true). */
    stripAnsi?: boolean;
}

/**
 * Incremental, per-source line splitter.
 *
 * The collector receives arbitrary chunks from consoles and child processes,
 * not whole lines. This state machine turns those chunks into complete lines:
 *
 *  - one `TextDecoder({ stream: true })` per source, so multi-byte UTF-8
 *    sequences split across chunks are decoded correctly;
 *  - `\n` (and `\r\n`) terminates a line, `\r` alone rewrites (drops) the
 *    current incomplete line — terminal progress bars such as
 *    `"50%\r100%\n"` only produce `"100%"`;
 *  - ANSI escape sequences are stripped when a line is emitted (they can be
 *    split across chunks, so stripping happens on the assembled line);
 *  - lines longer than `maxLineBytes` are truncated and marked with
 *    `… [line truncated, original N bytes]`.
 *
 * Empty lines are skipped. `flush()` emits the trailing partial line (used by
 * `flushSync()` on process exit).
 */
export class LineSplitter {
    private readonly decoder = new TextDecoder("utf-8");
    private readonly maxLineBytes: number;
    private readonly shouldStripAnsi: boolean;

    private parts: Array<string> = [];
    private bytes = 0;
    private totalBytes = 0;
    private truncated = false;
    private pendingCarriageReturn = false;
    private decoderStarted = false;

    constructor(options: LineSplitterOptions = {}) {
        this.maxLineBytes = Math.max(1, options.maxLineBytes ?? MAX_LINE_BYTES);
        this.shouldStripAnsi = options.stripAnsi ?? true;
    }

    /** Feed one chunk (string or raw bytes) into the splitter. */
    push(chunk: string | Uint8Array, sink: LineSink): void {
        if (typeof chunk === "string") {
            if (chunk.length > 0) this.processText(chunk, sink);
            return;
        }
        const text = this.decoder.decode(chunk, { stream: true });
        this.decoderStarted = true;
        if (text.length > 0) this.processText(text, sink);
    }

    /** Emit the trailing partial line and any pending decoder bytes. */
    flush(sink: LineSink): void {
        if (this.pendingCarriageReturn) {
            // a trailing lone \r only rewrites the current incomplete line
            this.pendingCarriageReturn = false;
            this.resetLine();
        }
        if (this.decoderStarted) {
            this.decoderStarted = false;
            const rest = this.decoder.decode();
            if (rest.length > 0) this.processText(rest, sink);
        }
        this.emit(sink);
    }

    private processText(text: string, sink: LineSink): void {
        let index = 0;

        if (this.pendingCarriageReturn) {
            this.pendingCarriageReturn = false;
            if (text.charCodeAt(0) === 10) {
                // the \r of a \r\n pair landed at the end of the previous chunk
                this.emit(sink);
                index = 1;
            } else {
                // lone \r: drop the partial line that was being rewritten
                this.resetLine();
            }
        }

        let start = index;
        while (index < text.length) {
            const code = text.charCodeAt(index);

            if (code === 10) {
                this.append(text.slice(start, index));
                this.emit(sink);
                index += 1;
                start = index;
                continue;
            }

            if (code === 13) {
                this.append(text.slice(start, index));
                if (index + 1 < text.length) {
                    if (text.charCodeAt(index + 1) === 10) {
                        this.emit(sink);
                        index += 2;
                    } else {
                        this.resetLine();
                        index += 1;
                    }
                    start = index;
                } else {
                    this.pendingCarriageReturn = true;
                    index += 1;
                    start = index;
                }
                continue;
            }

            index += 1;
        }

        if (start < text.length) this.append(text.slice(start));
    }

    private append(text: string): void {
        if (text.length === 0) return;
        if (this.truncated) {
            this.totalBytes += Buffer.byteLength(text, "utf-8");
            return;
        }

        const size = Buffer.byteLength(text, "utf-8");
        const remaining = this.maxLineBytes - this.bytes;
        if (size <= remaining) {
            this.parts.push(text);
            this.bytes += size;
            return;
        }

        const before = this.bytes;
        let head = Buffer.from(text, "utf-8").subarray(0, Math.max(0, remaining)).toString("utf-8");
        // do not keep half of a multi-byte character as a replacement char
        if (head.endsWith("\uFFFD")) head = head.slice(0, -1);
        const keptBytes = Buffer.byteLength(head, "utf-8");
        if (head.length > 0) this.parts.push(head);
        this.bytes = before + keptBytes;
        this.truncated = true;
        this.totalBytes = before + size;
    }

    private emit(sink: LineSink): void {
        if (this.bytes === 0 && !this.truncated) {
            this.resetLine();
            return;
        }

        let text = this.parts.join("");
        if (this.shouldStripAnsi) text = stripAnsiCodes(text);
        if (this.truncated) text = `${text}\u2026 [line truncated, original ${this.totalBytes} bytes]`;
        this.resetLine();
        if (text.length === 0 && !this.truncated) return;
        sink(text);
    }

    private resetLine(): void {
        this.parts = [];
        this.bytes = 0;
        this.totalBytes = 0;
        this.truncated = false;
    }
}
