import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LockedError } from "./errors";

export type ProjectLock = {
    file: string;
    release: () => Promise<void>;
};

const LOCK_FILE = "drizzle.lock";
/** A lock older than this is considered abandoned even if the PID still exists (PID reuse). */
const MAX_LOCK_AGE_MS = 30 * 60 * 1000;

/**
 * Acquire a per-project lock so two agents cannot run drizzle operations at the
 * same time (concurrent generates corrupt `_journal.json`).
 *
 * Stale locks (process no longer alive) are removed automatically.
 */
export async function acquireProjectLock(projectPath: string): Promise<ProjectLock> {
    const dir = join(projectPath, ".milkio");
    await mkdir(dir, { recursive: true });
    const file = join(dir, LOCK_FILE);

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await writeFile(file, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), {
                flag: "wx",
            });
            return {
                file,
                release: async () => {
                    await rm(file, { force: true });
                },
            };
        } catch (error) {
            if ((error as NodeJS.ErrnoException)?.code !== "EEXIST") throw error;
            if (!(await isStaleLock(file))) {
                throw new LockedError(
                    `Another drizzle operation is already running for this project (lock: ${file}). Wait for it to finish and retry.`,
                );
            }
            await rm(file, { force: true });
        }
    }

    throw new LockedError(`Could not acquire the drizzle lock for this project (lock: ${file}).`);
}

async function isStaleLock(file: string): Promise<boolean> {
    try {
        const parsed = JSON.parse(await readFile(file, "utf-8")) as { pid?: unknown; startedAt?: unknown };
        const pid = Number(parsed.pid);
        if (!Number.isInteger(pid) || pid <= 0) return true;

        const startedAt = typeof parsed.startedAt === "string" ? Date.parse(parsed.startedAt) : Number.NaN;
        if (Number.isFinite(startedAt) && Date.now() - startedAt > MAX_LOCK_AGE_MS) return true;

        try {
            // Signal 0 only checks whether the process exists.
            process.kill(pid, 0);
            return false;
        } catch (error) {
            // EPERM means the process exists but we may not signal it: not stale.
            if ((error as NodeJS.ErrnoException)?.code === "EPERM") return false;
            return true;
        }
    } catch {
        return true;
    }
}
