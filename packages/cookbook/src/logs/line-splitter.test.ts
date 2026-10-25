import { describe, expect, test } from "vite-plus/test";
import { LineSplitter, MAX_LINE_BYTES, type LineSplitterOptions } from "./line-splitter";

function collect(chunks: Array<string | Uint8Array>, options?: LineSplitterOptions): Array<string> {
    const lines: Array<string> = [];
    const splitter = new LineSplitter(options);
    for (const chunk of chunks) splitter.push(chunk, (line) => lines.push(line));
    splitter.flush((line) => lines.push(line));
    return lines;
}

function bytes(text: string, from = 0, to?: number): Uint8Array {
    return Buffer.from(text, "utf-8").subarray(from, to);
}

describe("LineSplitter", () => {
    test("splits complete lines and skips empty ones", () => {
        expect(collect(["hello\nworld\n"])).toEqual(["hello", "world"]);
        expect(collect(["\n\n"])).toEqual([]);
        expect(collect(["a\n\nb\n"])).toEqual(["a", "b"]);
    });

    test("flushes the trailing partial line once", () => {
        const lines: Array<string> = [];
        const splitter = new LineSplitter();
        splitter.push("no newline", (line) => lines.push(line));
        expect(lines).toEqual([]);
        splitter.flush((line) => lines.push(line));
        expect(lines).toEqual(["no newline"]);
        splitter.flush((line) => lines.push(line));
        expect(lines).toEqual(["no newline"]);
    });

    test("handles \\r\\n as a single newline, including across chunks", () => {
        expect(collect(["one\r\ntwo\r\n"])).toEqual(["one", "two"]);
        expect(collect(["one\r", "\ntwo\r", "\n"])).toEqual(["one", "two"]);
    });

    test("a lone \\r rewrites (drops) the current incomplete line", () => {
        expect(collect(["progress 50%\rprogress 100%\n"])).toEqual(["progress 100%"]);
        // \r at the end of a chunk, next chunk does not start with \n
        expect(collect(["old\r", "new\n"])).toEqual(["new"]);
        // trailing lone \r at flush time only drops the partial line
        expect(collect(["abc\r"])).toEqual([]);
    });

    test("strips ANSI escape sequences, even when split across chunks", () => {
        expect(collect(["\x1b[31mred\x1b[0m\n"])).toEqual(["red"]);
        expect(collect(["\x1b[31mred", "\x1b[0m\n"])).toEqual(["red"]);
        expect(collect(["\x1b[2K\x1b[1Gcleared\n"])).toEqual(["cleared"]);
    });

    test("decodes UTF-8 sequences split across byte chunks per source", () => {
        const raw = Buffer.from("你好，世界\n", "utf-8");
        expect(collect([raw.subarray(0, 4), raw.subarray(4)])).toEqual(["你好，世界"]);
        expect(collect([bytes("héllo\n", 0, 2), bytes("héllo\n", 2)])).toEqual(["héllo"]);
    });

    test("keeps separate state per instance (one splitter per source)", () => {
        const first = new LineSplitter();
        const second = new LineSplitter();
        const firstLines: Array<string> = [];
        const secondLines: Array<string> = [];
        first.push("alpha ", (line) => firstLines.push(line));
        second.push("beta\n", (line) => secondLines.push(line));
        first.push("done\n", (line) => firstLines.push(line));
        expect(firstLines).toEqual(["alpha done"]);
        expect(secondLines).toEqual(["beta"]);
    });

    test("preserves tabs and inner whitespace", () => {
        expect(collect(["  indented\tvalue  \n"])).toEqual(["  indented\tvalue  "]);
    });

    test("truncates lines beyond maxLineBytes with a marker", () => {
        const lines = collect(["abcdefghijkl\n"], { maxLineBytes: 8 });
        expect(lines).toEqual(["abcdefgh\u2026 [line truncated, original 12 bytes]"]);
    });

    test("keeps counting original bytes when a long line spans chunks", () => {
        const lines = collect(["abcdefgh", "ijkl", "mn\n"], { maxLineBytes: 8 });
        expect(lines).toEqual(["abcdefgh\u2026 [line truncated, original 14 bytes]"]);
    });

    test("caps by UTF-8 bytes, not characters", () => {
        const lines = collect(["你好", "好\n"], { maxLineBytes: 6 });
        expect(lines).toEqual(["你好\u2026 [line truncated, original 9 bytes]"]);
    });

    test("does not mark a line that fits exactly", () => {
        const lines = collect(["a".repeat(MAX_LINE_BYTES) + "\n"]);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toHaveLength(MAX_LINE_BYTES);
        expect(lines[0]).not.toContain("truncated");
    });

    test("truncates a pathological 1 MB+ line with the default cap", () => {
        const oversized = "x".repeat(MAX_LINE_BYTES + 512);
        const lines = collect([oversized + "\n"]);
        expect(lines).toHaveLength(1);
        expect(lines[0].startsWith("x".repeat(64))).toBe(true);
        expect(lines[0]).toContain(`\u2026 [line truncated, original ${MAX_LINE_BYTES + 512} bytes]`);
        expect(lines[0].length).toBeLessThan(MAX_LINE_BYTES + 128);
    });
});
