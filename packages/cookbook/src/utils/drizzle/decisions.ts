import { createHash } from "node:crypto";
import { stripAnsi } from "../../logs/ansi";
import { UsageError } from "./errors";

/** A single prompt emitted by drizzle-kit, translated into a decision. */
export type Decision = {
    /** Position in the sequence of prompts for this run (0-based). */
    index: number;
    /** `rename_or_create` are drizzle-kit's ambiguity questions, `confirm` are yes/no gates. */
    kind: "rename_or_create" | "confirm";
    /** The entity kind named by the question (column, table, view, enum, ...). */
    entity: string;
    question: string;
    options: Array<{ index: number; label: string; choice: string }>;
    /** Stable hash of question + options; used to verify a re-run sees the same prompt. */
    digest: string;
};

export type AnswerSpec = {
    fingerprint?: string;
    /** Option index to select for each prompt, in prompt order. */
    choices: number[];
    /** Optional per-prompt digests the caller saw when it decided. */
    digests: string[];
};

export type PromptPolicy = "create" | "rename" | "abort";

const RENAME_QUESTION =
    /^Is (.+?) (column in .+? table|table|view|enum|sequence|schema|role|policy) created or renamed from another (?:column|table|view|enum|sequence|schema|role|policy)\?$/;
const RENAME_OPTION = /^\s*(?:❯|›|>)?\s*([+~])\s+(.*?)\s+(create|rename)\s+(column|table|view|enum|sequence|schema|role|policy)\s*$/;
const CONFIRM_OPTION = /^\s*(?:❯|›|>)?\s*((?:No|Yes)[, ].*)$/;

/**
 * Scan an ANSI-stripped output buffer for the most recent drizzle-kit prompt.
 * Returns `null` when the buffer does not currently contain a recognizable prompt.
 *
 * Detection is deliberately structural (question line followed by option lines)
 * instead of matching one exact prompt string, so new rename targets keep working.
 */
export function detectDecision(buffer: string): Decision | null {
    const lines = stripAnsi(buffer).replace(/\r\n?/g, "\n").split("\n");

    for (let index = lines.length - 1; index >= 0; index--) {
        const question = lines[index].trim();
        if (!question.endsWith("?") || question.length < 8) continue;

        const options = parseOptions(lines, index + 1);
        if (!options || options.length < 2) continue;

        const kind = options.some((option) => option.choice === "create" || option.choice === "rename")
            ? "rename_or_create"
            : "confirm";
        if (kind === "confirm" && !options.some((option) => option.choice === "yes")) continue;

        const decision: Decision = {
            index: 0,
            kind,
            entity: questionEntity(question),
            question,
            options,
            digest: "",
        };
        decision.digest = decisionDigest(decision);
        return decision;
    }

    return null;
}

/** Hash of a whole decision list, useful for logging / tracing a decision round-trip. */
export function fingerprint(decisions: Decision[]): string {
    return createHash("sha256")
        .update(decisions.map((decision) => decision.digest).join("\n"))
        .digest("hex")
        .slice(0, 16);
}

/** Parse `--answers`. Accepts `[1]` or `{"fingerprint":"…","choices":[1],"digests":["…"]}`. */
export function parseAnswers(raw: string): AnswerSpec {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new UsageError(
            'Invalid --answers: expected JSON, for example \'[1]\' or \'{"choices":[1],"digests":["a1b2c3d4"]}\'.',
        );
    }

    if (Array.isArray(parsed)) {
        return { choices: parsed.map((value, index) => normalizeChoice(value, index)), digests: [] };
    }
    if (parsed !== null && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        const rawChoices = record.choices;
        if (!Array.isArray(rawChoices)) {
            throw new UsageError('Invalid --answers: object form needs a "choices" array of option indexes.');
        }
        const choices = rawChoices.map((value, index) => normalizeChoice(value, index));
        const digests = Array.isArray(record.digests) ? record.digests.map((value) => String(value)) : [];
        const fingerprintRaw = typeof record.fingerprint === "string" ? record.fingerprint : undefined;
        return { fingerprint: fingerprintRaw, choices, digests };
    }

    throw new UsageError('Invalid --answers: expected a JSON array or object.');
}

/** Parse `--on-prompt`. */
export function parseOnPrompt(raw: string): PromptPolicy {
    if (raw === "create" || raw === "rename" || raw === "abort") return raw;
    throw new UsageError('Invalid --on-prompt: expected "create", "rename" or "abort".');
}

/** Resolve the option index for a decision from an explicit choice list. */
export function choiceFromAnswers(decision: Decision, answers: AnswerSpec, promptIndex: number): number | null {
    const digest = answers.digests[promptIndex];
    if (digest !== undefined && digest !== decision.digest) return null;

    const choice = answers.choices[promptIndex];
    if (choice === undefined) return null;
    if (choice < 0 || choice >= decision.options.length) return null;
    return choice;
}

/** Resolve the option index for a decision from a `--on-prompt` policy (single-prompt runs only). */
export function choiceFromPolicy(decision: Decision, policy: PromptPolicy): number | null {
    if (policy === "abort") return null;
    if (decision.kind !== "rename_or_create") return null;
    const wanted = policy === "create" ? "create" : "rename";
    const option = decision.options.find((item) => item.choice === wanted);
    return option === undefined ? null : option.index;
}

/** Key sequence that moves the selection down by `index` rows and submits it. */
export function answerKeystrokes(optionIndex: number): string {
    return `${"\x1b[B".repeat(optionIndex)}\r`;
}

function parseOptions(
    lines: string[],
    start: number,
): Array<{ index: number; label: string; choice: string }> | null {
    const options: Array<{ index: number; label: string; choice: string }> = [];

    for (let index = start; index < lines.length && options.length < 12; index++) {
        const line = lines[index].trim();
        if (line.length === 0) break;
        // A new question means the previous prompt render ended.
        if (line.endsWith("?") && options.length > 0) break;

        const rename = RENAME_OPTION.exec(line);
        if (rename) {
            options.push({
                index: options.length,
                label: rename[2].trim(),
                choice: rename[1] === "+" ? "create" : "rename",
            });
            continue;
        }

        const confirm = CONFIRM_OPTION.exec(line);
        if (confirm) {
            const label = confirm[1].trim();
            options.push({
                index: options.length,
                label,
                choice: label.startsWith("Yes") ? "yes" : "no",
            });
            continue;
        }

        // Any other non-empty line is not part of the option list.
        break;
    }

    return options.length === 0 ? null : options;
}

function questionEntity(question: string): string {
    const match = RENAME_QUESTION.exec(question);
    if (!match) return "unknown";
    const target = match[2];
    if (target.startsWith("column in ")) return "column";
    return target;
}

function decisionDigest(decision: Decision): string {
    const material = [
        decision.question,
        ...decision.options.map((option) => `${option.choice}:${option.label}`),
    ].join("\n");
    return createHash("sha256").update(material).digest("hex").slice(0, 12);
}

function normalizeChoice(value: unknown, index: number): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        throw new UsageError(`Invalid --answers: choices[${index}] must be a non-negative integer option index.`);
    }
    return value;
}
