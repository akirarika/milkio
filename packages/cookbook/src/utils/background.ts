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

/**
 * Per-project runtime directory: "<cwd>/node_modules/.cookbook".
 *
 * Everything the background dev server owns lives under this directory so that
 * multiple projects started from different directories never interfere with
 * each other:
 *   - control-url.md   the cookbook server base URL (read by milkio-astra)
 *   - up-state.json    the background "co start" state (pid / ports / ...)
 *   - workers-status.json  per-worker readiness/state (read by "co start")
 *   - logs/            session log directories (see src/logs, read by "co logs")
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

export interface WorkersReadyTarget {
    name: string;
    /** used only to fill the `url` field of the returned readiness summary */
    url?: string;
}

export interface WorkersReadyEntry {
    readyMs?: number;
    attempts: number;
    url?: string;
}

export interface WaitForWorkersReadyOptions {
    /** default: "<cwd>/node_modules/.cookbook/workers-status.json" */
    statusPath?: string;
    intervalMs?: number;
    overallTimeoutMs?: number;
    isAborted?: () => boolean;
}

export interface WorkersReadyResult {
    success: boolean;
    error?: string;
    ready?: Record<string, WorkersReadyEntry>;
}

interface WorkersStatusEntry {
    state?: string;
    exitCode?: number | null;
    project?: string;
    ready?: boolean;
    readyAt?: string;
    readyMs?: number;
    attempts?: number;
    readyError?: string;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readWorkersStatus(path: string): Promise<Record<string, WorkersStatusEntry> | undefined> {
    try {
        const parsed = JSON.parse(await readFile(path, "utf-8"));
        if (!parsed || typeof parsed !== "object") return undefined;
        return parsed as Record<string, WorkersStatusEntry>;
    } catch {
        return undefined;
    }
}

/**
 * Wait for every worker of the background process to become ready by polling
 * the atomic `workers-status.json` file written by `src/workers`.
 *
 * This replaces the old HTTP poll: readiness probing is owned by exactly one
 * place (the background process) and the foreground launcher only observes the
 * result. Fails fast when a worker died (`state === "stopped"` with a numeric
 * exit code) or reported a `readyError`, and on the overall timeout.
 */
export async function waitForWorkersReadyByStatus(
    targets: Array<WorkersReadyTarget>,
    options: WaitForWorkersReadyOptions = {},
): Promise<WorkersReadyResult> {
    const ready: Record<string, WorkersReadyEntry> = {};
    if (targets.length === 0) return { success: true, ready };

    const intervalMs = options.intervalMs ?? 500;
    const overallTimeoutMs = options.overallTimeoutMs ?? 600_000;
    const statusPath = options.statusPath ?? join(getCookbookDir(), "workers-status.json");
    const deadline = Date.now() + overallTimeoutMs;
    const pending = new Set(targets.map((target) => target.name));

    while (true) {
        if (options.isAborted?.()) {
            return { success: false, error: "The background dev server process exited before becoming ready.", ready };
        }

        const status = await readWorkersStatus(statusPath);
        for (const target of targets) {
            if (!pending.has(target.name)) continue;
            const worker = status?.[target.name];
            if (!worker) continue;

            if (worker.readyError) {
                const error =
                    worker.readyError === "timeout"
                        ? `Project "${target.name}" did not become ready before the readiness timeout.`
                        : `The dev server process of project "${target.name}" failed to become ready: ${worker.readyError}`;
                return { success: false, error, ready };
            }
            if (worker.state === "stopped" && typeof worker.exitCode === "number") {
                return {
                    success: false,
                    error: `The dev server process of project "${target.name}" exited with code ${worker.exitCode} before becoming ready.`,
                    ready,
                };
            }
            if (worker.ready === true) {
                ready[target.name] = { readyMs: worker.readyMs, attempts: worker.attempts ?? 0, url: target.url };
                pending.delete(target.name);
            }
        }

        if (pending.size === 0) return { success: true, ready };
        if (Date.now() >= deadline) {
            return { success: false, error: `Timed out waiting for projects: ${[...pending].join(", ")}`, ready };
        }
        await sleep(intervalMs);
    }
}
