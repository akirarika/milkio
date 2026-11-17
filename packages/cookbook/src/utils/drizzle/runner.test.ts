import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { readJournal, readNewMigrations } from "./journal";
import { resolveDrizzleKitBin, runDrizzle } from "./runner";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../..");

// Keep the fixture inside the repo so `drizzle-orm`, `drizzle-kit` and the
// schema imports resolve through the workspace node_modules.
let fixtureRoot = "";
let projectDir = "";

const SCHEMA_V1 = `import { pgTable, varchar, char, integer } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: char("id", { length: 24 }).primaryKey(),
  oldName: varchar("oldName", { length: 32 }),
  age: integer("age"),
});
`;

const SCHEMA_V2 = `import { pgTable, varchar, char, integer } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: char("id", { length: 24 }).primaryKey(),
  newName: varchar("newName", { length: 32 }),
  age: integer("age"),
});
`;

const SCHEMA_V3 = `import { pgTable, varchar, char, integer } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: char("id", { length: 24 }).primaryKey(),
  otherName: varchar("otherName", { length: 32 }),
  age: integer("age"),
});
`;

const DRIZZLE_CONFIG = `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: "postgres://localhost:5432/fixture" },
});
`;

async function writeSchema(schema: string): Promise<void> {
    await writeFile(join(projectDir, "schema.ts"), schema, "utf-8");
}

describe("runDrizzle (drizzle-kit integration)", () => {
    beforeAll(async () => {
        fixtureRoot = await mkdtemp(join(REPO_ROOT, ".tmp", "co-drizzle-runner-"));
        projectDir = join(fixtureRoot, "project");
        await mkdir(projectDir, { recursive: true });
        await writeFile(
            join(projectDir, "package.json"),
            JSON.stringify({ name: "co-drizzle-runner-fixture", private: true, type: "module" }, null, 2),
            "utf-8",
        );
        await writeFile(join(projectDir, "drizzle.config.ts"), DRIZZLE_CONFIG, "utf-8");
        await writeSchema(SCHEMA_V1);
    }, 60_000);

    afterAll(async () => {
        if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true });
    });

    test(
        "generates the initial migration without prompting",
        async () => {
            const result = await runDrizzle({
                binPath: resolveDrizzleKitBin(projectDir),
                args: ["generate"],
                cwd: projectDir,
                promptCapable: true,
                successMarkers: [/Your SQL migration file/, /No schema changes/],
                timeoutMs: 120_000,
            });

            expect(result.aborted).toBe(false);
            expect(result.failure).toBeUndefined();
            expect(result.code).toBe(0);
            expect(result.completed).toBe(true);

            const journal = await readJournal(projectDir);
            expect(journal?.entries).toHaveLength(1);
        },
        180_000,
    );

    test(
        "aborts on a rename prompt and reports it as a decision (nothing written)",
        async () => {
            await writeSchema(SCHEMA_V2);
            const before = await readJournal(projectDir);

            const result = await runDrizzle({
                binPath: resolveDrizzleKitBin(projectDir),
                args: ["generate"],
                cwd: projectDir,
                promptCapable: true,
                successMarkers: [/Your SQL migration file/, /No schema changes/],
                timeoutMs: 120_000,
            });

            expect(result.aborted).toBe(true);
            expect(result.failure).toBe("decisions_required");
            expect(result.decisions).toHaveLength(1);
            expect(result.decisions[0].kind).toBe("rename_or_create");
            expect(result.decisions[0].entity).toBe("column");
            expect(result.decisions[0].options.map((option) => option.choice)).toEqual(["create", "rename"]);

            const after = await readJournal(projectDir);
            expect(after?.entries).toHaveLength(before?.entries.length ?? 0);
        },
        180_000,
    );

    test(
        "applies the decision and generates a RENAME COLUMN migration",
        async () => {
            const before = await readJournal(projectDir);
            const probe = await runDrizzle({
                binPath: resolveDrizzleKitBin(projectDir),
                args: ["generate"],
                cwd: projectDir,
                promptCapable: true,
                successMarkers: [/Your SQL migration file/, /No schema changes/],
                timeoutMs: 120_000,
            });
            expect(probe.aborted).toBe(true);
            const decision = probe.decisions[0];

            const result = await runDrizzle({
                binPath: resolveDrizzleKitBin(projectDir),
                args: ["generate"],
                cwd: projectDir,
                promptCapable: true,
                successMarkers: [/Your SQL migration file/, /No schema changes/],
                answers: { choices: [1], digests: [decision.digest] },
                timeoutMs: 120_000,
            });

            expect(result.aborted).toBe(false);
            expect(result.failure).toBeUndefined();
            expect(result.code).toBe(0);
            expect(result.usedChoices).toEqual([1]);
            expect(result.completed).toBe(true);

            const after = await readJournal(projectDir);
            expect(after?.entries).toHaveLength((before?.entries.length ?? 0) + 1);
            const migrations = await readNewMigrations(projectDir, before, after!);
            expect(migrations).toHaveLength(1);
            expect(migrations[0].sql).toContain('RENAME COLUMN "oldName" TO "newName"');
        },
        180_000,
    );

    test(
        "rejects answers whose digest does not match the prompt",
        async () => {
            // Introduce a fresh ambiguity so the run actually prompts.
            await writeSchema(SCHEMA_V3);

            const result = await runDrizzle({
                binPath: resolveDrizzleKitBin(projectDir),
                args: ["generate"],
                cwd: projectDir,
                promptCapable: true,
                successMarkers: [/Your SQL migration file/, /No schema changes/],
                answers: { choices: [1], digests: ["deadbeefdead"] },
                timeoutMs: 120_000,
            });

            expect(result.aborted).toBe(true);
            expect(result.failure).toBe("mismatch");
        },
        180_000,
    );
});
