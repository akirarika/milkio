import type { LogRecord, LogStream } from "./types";

/**
 * Error detection shared by the collector (precomputed `err` flag) and the
 * log viewer (for records without the flag / for `--errors`).
 *
 * Rules:
 *  - stream === "stderr" is always an error (handled by isErrorRecord).
 *  - Chinese is scanned character by character (no whitespace tokenization):
 *    错误 / 异常.
 *  - English is scanned word by word (whitespace separated) for efficiency;
 *    every word is then split into components on non-alphanumeric characters
 *    and camelCase boundaries, so `TypeError`, `ERROR_CODE`, `[error]`,
 *    `readFile failed` are all detected while `terror` / `failover` are not.
 */
const ERROR_WORDS = new Set(["error", "errors", "fail", "fails", "failed", "failing", "failure", "failures"]);

const CJK_MISTAKE = "\u9519"; // 错
const CJK_MISTAKE_2 = "\u8BEF"; // 误
const CJK_ABNORMAL = "\u5F02"; // 异
const CJK_ABNORMAL_2 = "\u5E38"; // 常

function isAsciiDigit(code: number): boolean {
    return code >= 48 && code <= 57;
}

function isAsciiUpper(code: number): boolean {
    return code >= 65 && code <= 90;
}

function isAsciiLower(code: number): boolean {
    return code >= 97 && code <= 122;
}

function isAsciiAlnum(code: number): boolean {
    return isAsciiDigit(code) || isAsciiUpper(code) || isAsciiLower(code);
}

function isWhitespace(code: number): boolean {
    // space, tab, LF, VT, FF, CR and ideographic space
    return code === 32 || code === 9 || code === 10 || code === 11 || code === 12 || code === 13 || code === 0x3000;
}

function isErrorWord(text: string, start: number, end: number): boolean {
    if (end - start < 4 || end - start > 8) return false;
    return ERROR_WORDS.has(text.slice(start, end).toLowerCase());
}

/** Split one whitespace-delimited token into components and test each of them. */
function tokenHasErrorWord(text: string, start: number, end: number): boolean {
    let partStart = start;
    for (let index = start; index < end; index++) {
        const code = text.charCodeAt(index);
        if (!isAsciiAlnum(code)) {
            if (partStart < index && isErrorWord(text, partStart, index)) return true;
            partStart = index + 1;
            continue;
        }
        if (index > partStart && isAsciiUpper(code) && isAsciiLower(text.charCodeAt(index - 1))) {
            if (isErrorWord(text, partStart, index)) return true;
            partStart = index;
        }
    }
    return partStart < end && isErrorWord(text, partStart, end);
}

export function isErrorText(text: string): boolean {
    if (text.length === 0) return false;

    // Chinese: per-character scan (错误 / 异常)
    for (let index = 0; index + 1 < text.length; index++) {
        const first = text[index];
        if ((first === CJK_MISTAKE && text[index + 1] === CJK_MISTAKE_2) || (first === CJK_ABNORMAL && text[index + 1] === CJK_ABNORMAL_2)) {
            return true;
        }
    }

    // English: whitespace-separated words, then components within each word
    let tokenStart = -1;
    for (let index = 0; index <= text.length; index++) {
        const atEnd = index === text.length;
        if (!atEnd && !isWhitespace(text.charCodeAt(index))) {
            if (tokenStart < 0) tokenStart = index;
            continue;
        }
        if (tokenStart >= 0) {
            if (tokenHasErrorWord(text, tokenStart, index)) return true;
            tokenStart = -1;
        }
    }

    return false;
}

export function isErrorRecord(record: { stream: LogStream; text: string; err?: boolean }): boolean {
    if (record.stream === "stderr") return true;
    if (typeof record.err === "boolean") return record.err;
    return isErrorText(record.text);
}

export function isErrorLine(record: Pick<LogRecord, "stream" | "text" | "err">): boolean {
    return isErrorRecord(record);
}
