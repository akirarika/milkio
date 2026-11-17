import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { writeFileEnsured } from "../node-compat";

export type JournalEntry = {
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints?: boolean;
};

export type Journal = {
    version: string;
    dialect: string;
    entries: JournalEntry[];
};

export type MigrationFile = {
    tag: string;
    file: string;
    sql: string;
};

/** The directory drizzle-kit writes migrations to (milkio convention). */
export function migrationsDir(projectPath: string): string {
    return join(projectPath, "drizzle");
}

export function journalPath(projectPath: string): string {
    return join(migrationsDir(projectPath), "meta", "_journal.json");
}

/** Read `drizzle/meta/_journal.json`, returning `null` when it does not exist yet. */
export async function readJournal(projectPath: string): Promise<Journal | null> {
    try {
        const parsed = JSON.parse(await readFile(journalPath(projectPath), "utf-8")) as Journal;
        if (!Array.isArray(parsed?.entries)) return null;
        return parsed;
    } catch {
        return null;
    }
}

/** Journal entries that exist in `after` but not in `before`. */
export function newJournalEntries(before: Journal | null, after: Journal): JournalEntry[] {
    const known = new Set((before?.entries ?? []).map((entry) => entry.tag));
    return (after.entries ?? []).filter((entry) => !known.has(entry.tag));
}

async function readEntrySql(projectPath: string, entry: JournalEntry): Promise<string> {
    try {
        return await readFile(join(migrationsDir(projectPath), `${entry.tag}.sql`), "utf-8");
    } catch {
        return "";
    }
}

/** All migrations with their SQL, in journal order (used for `.milkio/drizzle-migrations.ts`). */
export async function readMigrations(projectPath: string, journal: Journal): Promise<MigrationFile[]> {
    const migrations: MigrationFile[] = [];
    for (const entry of journal.entries ?? []) {
        migrations.push({
            tag: entry.tag,
            file: join(migrationsDir(projectPath), `${entry.tag}.sql`),
            sql: await readEntrySql(projectPath, entry),
        });
    }
    return migrations;
}

/** Newly generated migrations (only the ones added by the latest generate run). */
export async function readNewMigrations(
    projectPath: string,
    before: Journal | null,
    after: Journal,
): Promise<MigrationFile[]> {
    const migrations: MigrationFile[] = [];
    for (const entry of newJournalEntries(before, after)) {
        migrations.push({
            tag: entry.tag,
            file: join(migrationsDir(projectPath), `${entry.tag}.sql`),
            sql: await readEntrySql(projectPath, entry),
        });
    }
    return migrations;
}

/** Regenerate `.milkio/drizzle-migrations.ts` (bundled migrations for the runtime). */
export async function writeMilkioMigrations(projectPath: string, journal: Journal): Promise<string> {
    const target = join(projectPath, ".milkio", "drizzle-migrations.ts");
    const withSql = {
        ...journal,
        entries: await Promise.all(
            (journal.entries ?? []).map(async (entry) => ({
                ...entry,
                sql: await readEntrySql(projectPath, entry),
            })),
        ),
    };
    await writeFileEnsured(target, `export const drizzleMigrations = ${JSON.stringify(withSql)}`);
    return target;
}
