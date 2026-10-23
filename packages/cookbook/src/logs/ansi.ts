/**
 * ANSI escape sequence helpers shared by the log collector and the log viewer.
 *
 * Log files store plain text: every record has its terminal color codes
 * stripped before it is written. The pattern also handles OSC sequences
 * (window titles / hyperlinks) and single-character escapes so that a stray
 * control sequence can never leak into a JSONL record.
 */
// oxlint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_])/g;

/** True when the text contains at least one ESC character worth stripping. */
export function hasAnsi(text: string): boolean {
    return text.includes("\x1b");
}

/** Remove every ANSI escape sequence from the text. */
export function stripAnsi(text: string): string {
    if (!hasAnsi(text)) return text;
    return text.replace(ANSI_PATTERN, "");
}
