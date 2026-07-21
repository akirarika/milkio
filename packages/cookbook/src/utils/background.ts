import { join } from "node:path";
import { cwd } from "node:process";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { killPort } from "./kill-port";

export type BackgroundState = {
    pid: number;
    mode: string;
    ports: Array<number>;
    startedAt: string;
};

export type ReadyTarget = {
    name: string;
    url: string;
    port: number;
};

/**
 * Per-project runtime directory: "<cwd>/node_modules/.cookbook".
 *
 * Everything the background dev server owns lives under this directory so that
 * multiple projects started from different directories never interfere with
 * each other:
 *   - control-url.md the cookbook server base URL (read by milkio-astra)
 *   - up-state.json the background "co start" state (pid / ports / ...)
 *   - logs/         rotating background log files (followed by "co logs")
 */
export function getCookbookDir() {
    return join(cwd(), "node_modules", ".cookbook");
}

/**
 * Ensures "<cwd>/node_modules/.cookbook" exists as a directory.
 *
 * Older versions of cookbook wrote the server base URL directly to a plain file
 * named ".cookbook". If such a stale file is still present, `mkdir` would fail
 * with EEXIST, so remove it first and (re)create the directory.
 */
export function ensureCookbookDir(): string {
    const dir = getCookbookDir();
    try {
        if (!statSync(dir).isDirectory()) {
            rmSync(dir, { force: true });
            mkdirSync(dir, { recursive: true });
        }
    } catch {
        mkdirSync(dir, { recursive: true });
    }
    return dir;
}

export function getStatePath() {
    return join(getCookbookDir(), "up-state.json");
}

export function getLogsDir() {
    return join(getCookbookDir(), "logs");
}

export async function readState(): Promise<BackgroundState | undefined> {
    try {
        const state = JSON.parse(await readFile(getStatePath(), "utf-8"));
        if (typeof state?.pid !== "number") return undefined;
        return state as BackgroundState;
    } catch {
        return undefined;
    }
}

export async function writeState(state: BackgroundState): Promise<void> {
    ensureCookbookDir();
    await writeFile(getStatePath(), JSON.stringify(state, null, 2), "utf-8");
}

export async function clearState(): Promise<void> {
    await rm(getStatePath(), { force: true });
}

export function isPidAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error: any) {
        return error?.code === "EPERM";
    }
}

export function isRunning(state: BackgroundState): boolean {
    return isPidAlive(state.pid);
}

export async function killProcessTree(pid: number): Promise<void> {
    if (!isPidAlive(pid)) return;
    if (process.platform === "win32") {
        await new Promise<void>((resolve) => {
            const killer = spawn("taskkill", ["/PID", `${pid}`, "/T", "/F"], { stdio: "ignore" });
            killer.on("exit", () => resolve());
            killer.on("error", () => resolve());
        });
    } else {
        // the background process was spawned detached, so it leads its own process group
        try {
            process.kill(-pid, "SIGKILL");
        } catch {
            try {
                process.kill(pid, "SIGKILL");
            } catch {}
        }
    }
    for (let i = 0; i < 100 && isPidAlive(pid); i++) await Bun.sleep(100);
}

export async function stopBackground(state: BackgroundState): Promise<void> {
    await killProcessTree(state.pid);
    // fallback: make sure the project ports are freed
    for (const port of state.ports ?? []) {
        try {
            await killPort(port);
        } catch {}
    }
}

export async function waitForProjectsReady(
    targets: Array<ReadyTarget>,
    options: {
        intervalMs?: number;
        requestTimeoutMs?: number;
        overallTimeoutMs?: number;
        isAborted?: () => boolean;
        /**
         * Checked on every poll iteration. Return a human-readable failure
         * message to abort the wait immediately (fail fast), or undefined to
         * keep waiting. Used by "co start" to surface worker processes that
         * died before their URL ever responded.
         */
        getFailure?: () => Promise<string | undefined>;
    } = {},
): Promise<{ success: boolean; error?: string }> {
    if (targets.length === 0) return { success: true };
    const intervalMs = options.intervalMs ?? 1000;
    const requestTimeoutMs = options.requestTimeoutMs ?? 5000;
    const deadline = Date.now() + (options.overallTimeoutMs ?? 600_000);
    const pending = new Map(targets.map((target) => [target.name, target]));

    while (Date.now() < deadline) {
        if (options.isAborted?.()) {
            return { success: false, error: "The background dev server process exited before becoming ready." };
        }
        const failure = await options.getFailure?.();
        if (failure) {
            return { success: false, error: failure };
        }
        await Promise.all(
            [...pending.values()].map(async (target) => {
                try {
                    const response = await fetch(target.url, { signal: AbortSignal.timeout(requestTimeoutMs) });
                    if (response.status >= 200 && response.status < 500) pending.delete(target.name);
                } catch {
                    // not ready yet
                }
            }),
        );
        if (pending.size === 0) return { success: true };
        await Bun.sleep(intervalMs);
    }

    return { success: false, error: `Timed out waiting for projects: ${[...pending.keys()].join(", ")}` };
}
