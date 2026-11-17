import { describe, expect, test } from "vite-plus/test";
import {
    answerKeystrokes,
    choiceFromAnswers,
    choiceFromPolicy,
    detectDecision,
    fingerprint,
    parseAnswers,
    parseOnPrompt,
} from "./decisions";
import { UsageError } from "./errors";

/** Captured drizzle-kit 0.31.11 output for a column rename ambiguity (two redraws). */
const RENAME_COLUMN_PROMPT = `Reading config file '.\\.tmp\\dk-probe\\drizzle.config.v2.ts'

Is newName column in user table created or renamed from another column?
❯ + newName           create column
  ~ oldName › newName rename column
Is newName column in user table created or renamed from another column?
  + newName           create column
❯ ~ oldName › newName rename column
`;

const RENAME_TABLE_PROMPT = `Is user2 table created or renamed from another table?
❯ + user2 create table
  ~ user rename table
`;

const PUSH_DATA_LOSS_PROMPT = `THIS ACTION WILL CAUSE DATA LOSS AND CANNOT BE REVERTED

Do you still want to push changes?
❯ No, abort
  Yes, I want to remove 1 table
`;

const TRUNCATE_PROMPT = `You're about to add foo unique constraint to the table, which contains 10 items. If this statement fails, you will receive an error from the database. Do you want to truncate bar table?
❯ No, add the constraint without truncating the table
  Yes, truncate the table
`;

describe("detectDecision", () => {
    test("parses the rename prompt and uses the last render", () => {
        const decision = detectDecision(RENAME_COLUMN_PROMPT);
        expect(decision).not.toBeNull();
        expect(decision!.kind).toBe("rename_or_create");
        expect(decision!.entity).toBe("column");
        expect(decision!.question).toBe(
            "Is newName column in user table created or renamed from another column?",
        );
        expect(decision!.options.map((option) => option.choice)).toEqual(["create", "rename"]);
        expect(decision!.options[1].label).toBe("oldName › newName");
    });

    test("parses table rename prompts too", () => {
        const decision = detectDecision(RENAME_TABLE_PROMPT);
        expect(decision!.kind).toBe("rename_or_create");
        expect(decision!.entity).toBe("table");
        expect(decision!.options.map((option) => option.choice)).toEqual(["create", "rename"]);
    });

    test("parses confirmation prompts", () => {
        const dataLoss = detectDecision(PUSH_DATA_LOSS_PROMPT);
        expect(dataLoss!.kind).toBe("confirm");
        expect(dataLoss!.question).toBe("Do you still want to push changes?");
        expect(dataLoss!.options.map((option) => option.choice)).toEqual(["no", "yes"]);

        const truncate = detectDecision(TRUNCATE_PROMPT);
        expect(truncate!.kind).toBe("confirm");
        expect(truncate!.options.map((option) => option.choice)).toEqual(["no", "yes"]);
    });

    test("ignores ordinary output", () => {
        expect(detectDecision("Reading config file 'drizzle.config.ts'\n1 tables\n")).toBeNull();
        expect(detectDecision("")).toBeNull();
        // A question without recognizable options is not a prompt.
        expect(detectDecision("Do you want to continue?\n")).toBeNull();
    });

    test("strips ANSI escapes before parsing", () => {
        const ansi = `\u001b[2K\u001b[1GIs foo column in user table created or renamed from another column?`
            + `\n\u001b[32m❯ + foo\u001b[0m           create column`
            + `\n  ~ bar › foo rename column`;
        const decision = detectDecision(ansi);
        expect(decision!.options.map((option) => option.choice)).toEqual(["create", "rename"]);
    });

    test("parses Windows CRLF output", () => {
        const crlf = RENAME_COLUMN_PROMPT.replace(/\n/g, "\r\n");
        const decision = detectDecision(crlf);
        expect(decision).not.toBeNull();
        expect(decision!.options.map((option) => option.choice)).toEqual(["create", "rename"]);
    });

    test("digest changes when the options change", () => {
        const first = detectDecision(RENAME_TABLE_PROMPT)!;
        const second = detectDecision(RENAME_TABLE_PROMPT.replace("~ user rename table", "~ account rename table"))!;
        expect(first.digest).not.toBe(second.digest);
    });

    test("fingerprint is stable for the same decision list", () => {
        const decision = detectDecision(RENAME_COLUMN_PROMPT)!;
        expect(fingerprint([decision])).toBe(fingerprint([decision]));
        expect(fingerprint([decision])).toHaveLength(16);
    });
});

describe("parseAnswers", () => {
    test("accepts an array of option indexes", () => {
        expect(parseAnswers("[1]")).toEqual({ choices: [1], digests: [] });
        expect(parseAnswers("[0,1]")).toEqual({ choices: [0, 1], digests: [] });
    });

    test("accepts the object form", () => {
        expect(parseAnswers('{"fingerprint":"abc","choices":[1],"digests":["d1"]}')).toEqual({
            fingerprint: "abc",
            choices: [1],
            digests: ["d1"],
        });
    });

    test("rejects invalid payloads", () => {
        expect(() => parseAnswers("nope")).toThrow(UsageError);
        expect(() => parseAnswers('{"digests":[]}')).toThrow(UsageError);
        expect(() => parseAnswers("[-1]")).toThrow(UsageError);
        expect(() => parseAnswers('["0"]')).toThrow(UsageError);
        expect(() => parseAnswers("1")).toThrow(UsageError);
    });
});

describe("parseOnPrompt", () => {
    test("accepts the three policies", () => {
        expect(parseOnPrompt("create")).toBe("create");
        expect(parseOnPrompt("rename")).toBe("rename");
        expect(parseOnPrompt("abort")).toBe("abort");
    });

    test("rejects anything else", () => {
        expect(() => parseOnPrompt("yes")).toThrow(UsageError);
    });
});

describe("choosing an option", () => {
    const decision = detectDecision(RENAME_COLUMN_PROMPT)!;

    test("uses the provided choice index", () => {
        expect(choiceFromAnswers(decision, { choices: [1], digests: [] }, 0)).toBe(1);
        expect(choiceFromAnswers(decision, { choices: [9], digests: [] }, 0)).toBeNull();
        expect(choiceFromAnswers(decision, { choices: [], digests: [] }, 0)).toBeNull();
    });

    test("rejects a decision whose digest changed", () => {
        expect(
            choiceFromAnswers(decision, { choices: [1], digests: ["deadbeef"] }, 0),
        ).toBeNull();
        expect(
            choiceFromAnswers(decision, { choices: [1], digests: [decision.digest] }, 0),
        ).toBe(1);
    });

    test("maps --on-prompt policies to option indexes", () => {
        expect(choiceFromPolicy(decision, "rename")).toBe(1);
        expect(choiceFromPolicy(decision, "create")).toBe(0);
        expect(choiceFromPolicy(decision, "abort")).toBeNull();
        const confirm = detectDecision(PUSH_DATA_LOSS_PROMPT)!;
        expect(choiceFromPolicy(confirm, "rename")).toBeNull();
    });

    test("builds arrow-key keystrokes", () => {
        expect(answerKeystrokes(0)).toBe("\r");
        expect(answerKeystrokes(2)).toBe("\u001b[B\u001b[B\r");
    });
});
