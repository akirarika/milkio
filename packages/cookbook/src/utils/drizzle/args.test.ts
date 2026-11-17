import { describe, expect, test } from "vite-plus/test";
import { buildDrizzleKitArgs, isFlagSet } from "./args";
import { UsageError } from "./errors";
import { newJournalEntries, type Journal } from "./journal";

function journal(tags: string[]): Journal {
    return {
        version: "7",
        dialect: "postgresql",
        entries: tags.map((tag, index) => ({ idx: index, version: "7", when: 0, tag })),
    };
}

describe("buildDrizzleKitArgs", () => {
    test("forwards allowlisted options and drops cookbook flags", () => {
        expect(
            buildDrizzleKitArgs("generate", {
                project: "test",
                mode: "test",
                yes: "1",
                json: "1",
                name: "add-user-table",
                custom: "1",
            }),
        ).toEqual(["--name=add-user-table", "--custom"]);
    });

    test("supports different allowlists per subcommand", () => {
        expect(buildDrizzleKitArgs("push", { verbose: "1" })).toEqual(["--verbose"]);
        expect(buildDrizzleKitArgs("pull", { "introspect-casing": "camel" })).toEqual([
            "--introspect-casing=camel",
        ]);
        expect(() => buildDrizzleKitArgs("generate", { verbose: "1" })).toThrow(UsageError);
        expect(() => buildDrizzleKitArgs("pull", { name: "x" })).toThrow(UsageError);
    });

    test("rejects unknown options instead of silently dropping them", () => {
        expect(() => buildDrizzleKitArgs("generate", { forcee: "1" })).toThrow(UsageError);
    });

    test("rejects unsupported subcommands", () => {
        expect(() => buildDrizzleKitArgs("studio", {})).toThrow(UsageError);
    });
});

describe("isFlagSet", () => {
    test("understands the CLI boolean encoding", () => {
        expect(isFlagSet({ json: "1" }, "json")).toBe(true);
        expect(isFlagSet({ json: true }, "json")).toBe(true);
        expect(isFlagSet({ json: "0" }, "json")).toBe(false);
        expect(isFlagSet({}, "json")).toBe(false);
    });
});

describe("newJournalEntries", () => {
    test("returns only entries added by the latest run", () => {
        const before = journal(["0000_a"]);
        const after = journal(["0000_a", "0001_b"]);
        expect(newJournalEntries(before, after).map((entry) => entry.tag)).toEqual(["0001_b"]);
    });

    test("handles a missing previous journal", () => {
        expect(newJournalEntries(null, journal(["0000_a"])).map((entry) => entry.tag)).toEqual(["0000_a"]);
    });

    test("returns nothing when the journal did not change", () => {
        const same = journal(["0000_a", "0001_b"]);
        expect(newJournalEntries(same, same)).toEqual([]);
    });
});
