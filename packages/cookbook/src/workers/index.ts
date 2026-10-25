import os from "node:os";
import { join } from "node:path";
import { cwd, stdout } from "node:process";
import type { CookbookOptions } from "../utils/cookbook-dto-types.ts";
import { spawn, type ChildProcess } from "node:child_process";
import killPort from "kill-port";
import { rename, unlink, writeFile } from "node:fs/promises";
import { outputPrefix, setMaxNameLength } from "../utils/output-prefix.ts";
import { ensureCookbookDir, getCookbookDir } from "../utils/background.ts";
import { getLogCollector } from "../logs/collector.ts";

const platform = os.platform();
let workerId = 1;

const READY_PROBE_INTERVAL_MS = 500;
const READY_PROBE_REQUEST_TIMEOUT_MS = 5000;
const DEFAULT_READY_TIMEOUT_MS = 600_000;

export const workers = new Map<string, Worker>();

export interface Worker {
    id: number;
    key: string;
    state: "running" | "stopped";
    /** exit code of the last process run, null while running / not started */
    exitCode: number | null;
    connect: boolean;
    /** readiness probe state (single authority: the background process) */
    ready: boolean;
    /** ISO timestamp of the moment the probe succeeded */
    readyAt?: string;
    readyMs?: number;
    readyAttempts: number;
    readyError?: string;
    meta: CookbookOptions["projects"][keyof CookbookOptions["projects"]]["meta"];
    kill: () => Promise<void>;
    run: (meta?: CookbookOptions["projects"][keyof CookbookOptions["projects"]]["meta"]) => void;
    testConnect: (timeout?: number) => Promise<{
        success: boolean;
        error?: string;
    }>;
}

export interface WorkersReadyEntry {
    readyMs?: number;
    attempts: number;
    url?: string;
}

export interface WorkersReadyResult {
    success: boolean;
    error?: string;
    ready: Record<string, WorkersReadyEntry>;
}

interface WorkerRuntime {
    spawnProcess: ChildProcess | null;
    /** incremented to invalidate an in-flight readiness probe */
    probeToken: number;
    cancelProbe?: () => void;
    readyUrl?: string;
    autoStart: boolean;
    /** run() was called and the child process setup is still in flight */
    starting: boolean;
    started: boolean;
    intentionalStop: boolean;
    stdoutDecoder?: TextDecoder;
    stderrDecoder?: TextDecoder;
}

const runtimes = new Map<string, WorkerRuntime>();

function intEnv(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

function emitWorkerEvent(key: string, level: "info" | "error", text: string, kind: string, meta?: Record<string, unknown>): void {
    try {
        getLogCollector()?.event(`worker:${key}`, level, text, { kind, meta: { project: key, ...meta } });
    } catch {
        // logging must never take a worker down
    }
}

/**
 * Persists the state of every worker to "<cwd>/node_modules/.cookbook/workers-status.json".
 *
 * Writes are atomic (unique temp file + rename) so "co start" never observes a
 * half-written file. "co start" polls this file while waiting for projects to
 * become ready: if a worker's dev server process exits before its URL ever
 * responded, the start command can fail fast with a clear error instead of
 * polling until the overall timeout.
 */
async function writeWorkersStatus(): Promise<void> {
    const status: Record<string, {
        state: Worker["state"];
        exitCode: number | null;
        project: string;
        ready: boolean;
        readyAt?: string;
        readyMs?: number;
        attempts: number;
        readyError?: string;
    }> = {};
    for (const [key, worker] of workers) {
        status[key] = {
            state: worker.state,
            exitCode: worker.exitCode,
            project: key,
            ready: worker.ready,
            readyAt: worker.readyAt,
            readyMs: worker.readyMs,
            attempts: worker.readyAttempts,
            readyError: worker.readyError,
        };
    }

    try {
        ensureCookbookDir();
    } catch {
        // fall through: the write below reports the real error
    }
    const path = join(getCookbookDir(), "workers-status.json");
    const temporaryPath = `${path}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
    const text = JSON.stringify(status, null, 2);
    try {
        await writeFile(temporaryPath, text, "utf-8");
        await rename(temporaryPath, path);
    } catch {
        try {
            await writeFile(path, text, "utf-8");
        } catch {}
        await unlink(temporaryPath).catch(() => {});
    }
}

function cancelReadyProbe(key: string, worker: Worker, runtime: WorkerRuntime): void {
    if (!runtime.cancelProbe) return;
    runtime.cancelProbe();
    runtime.cancelProbe = undefined;
    runtime.probeToken += 1;
    if (!worker.ready) {
        emitWorkerEvent(key, "info", "readiness probe cancelled before the worker became ready", "worker-ready-cancelled", { url: runtime.readyUrl });
    }
}

/**
 * Single-authority readiness probe for one worker.
 *
 * Polls `connectTestUrl` every 500 ms (5 s per request). Success means any
 * HTTP status below 500. The probe stops when the worker exits, when it is
 * intentionally stopped, on success, on timeout, and when it is superseded by
 * a restart (a new `run()`).
 */
function startReadyProbe(worker: Worker, runtime: WorkerRuntime, key: string, url: string): void {
    const token = ++runtime.probeToken;
    const startedAt = Date.now();
    const overallTimeoutMs = intEnv("COOKBOOK_READY_TIMEOUT_MS", DEFAULT_READY_TIMEOUT_MS);
    runtime.readyUrl = url;
    runtime.cancelProbe = () => {};

    const isCurrent = (): boolean => runtime.probeToken === token && worker.state === "running";

    const loop = async (): Promise<void> => {
        while (isCurrent()) {
            const elapsed = Date.now() - startedAt;
            if (elapsed >= overallTimeoutMs) {
                if (!isCurrent()) return;
                worker.ready = false;
                worker.readyError = "timeout";
                worker.readyMs = elapsed;
                runtime.cancelProbe = undefined;
                void writeWorkersStatus();
                emitWorkerEvent(
                    key,
                    "error",
                    `readiness probe timed out after ${elapsed}ms (${worker.readyAttempts} probe(s)) → ${url}`,
                    "worker-ready-timeout",
                    { url, attempts: worker.readyAttempts, timeoutMs: overallTimeoutMs },
                );
                return;
            }

            worker.readyAttempts += 1;
            let ready = false;
            try {
                const response = await fetch(url, { signal: AbortSignal.timeout(READY_PROBE_REQUEST_TIMEOUT_MS) });
                ready = response.status < 500;
            } catch {
                ready = false;
            }
            if (!isCurrent()) return;

            if (ready) {
                worker.ready = true;
                worker.readyError = undefined;
                worker.readyMs = Date.now() - startedAt;
                worker.readyAt = new Date().toISOString();
                runtime.cancelProbe = undefined;
                void writeWorkersStatus();
                emitWorkerEvent(
                    key,
                    "info",
                    `ready in ${worker.readyMs}ms (${worker.readyAttempts} probe(s)) → ${url}`,
                    "worker-ready",
                    { url, readyMs: worker.readyMs, attempts: worker.readyAttempts },
                );
                return;
            }
            await sleep(READY_PROBE_INTERVAL_MS);
        }
    };

    void loop();
}

/**
 * Publish the initial worker states so "co start" never reads stale statuses
 * left behind by a previous run. Workers with `autoStart === false` are
 * recorded as intentionally skipped.
 */
export async function initWorkers(options: CookbookOptions, mode: string, baseUrl: string) {
    for (const projectName in options.projects ?? {}) {
        const project = options.projects[projectName];
        const autoStart = project.autoStart || project.autoStart === undefined;
        const envMap: NodeJS.ProcessEnv = { MODE: mode, VITE_MODE: mode, COOKBOOK_BASE_URL: baseUrl, MILKIO_PORT: `${project.port}` };
        const worker = createWorker(projectName, {
            env: envMap,
            command: project.start ?? `${options.general.packageManager} run dev`,
            cwd: join(cwd(), "projects", projectName),
            port: project.port,
            connectTestUrl: project?.connectTestUrl ?? (project.type !== "milkio" ? `http://localhost:${project.port}/` : `http://localhost:${project.port}/generate_204`),
            autoStart,
        });
        workers.set(projectName, worker);
        if (autoStart) {
            setTimeout(() => worker.run(), (project.autoStartDelay ?? 0) * 1000);
        } else {
            emitWorkerEvent(projectName, "info", "readiness probe skipped (autoStart = false)", "worker-ready-skipped");
        }
    }
    // publish the initial state so "co start" never reads stale worker
    // statuses left behind by a previous run
    await writeWorkersStatus();
}

export function createWorker(
    key: string,
    options: {
        command: string;
        cwd?: string;
        env?: NodeJS.ProcessEnv;
        stdout?: "pipe" | "ignore";
        connectTestUrl?: string;
        port?: number;
        autoStart?: boolean;
    },
): Worker {
    setMaxNameLength(key);
    const runtime: WorkerRuntime = {
        spawnProcess: null,
        probeToken: 0,
        autoStart: options.autoStart ?? true,
        starting: false,
        started: false,
        intentionalStop: false,
    };
    runtimes.set(key, runtime);

    let worker: Worker;

    const handleExit = (code: number | null, signal: NodeJS.Signals | null) => {
        const wasReady = worker.ready;
        worker.state = "stopped";
        worker.exitCode = code;
        runtime.probeToken += 1;
        runtime.cancelProbe = undefined;

        if (runtime.started && !wasReady && !runtime.intentionalStop) {
            worker.ready = false;
            worker.readyError = `process exited with code ${code ?? "null"}${signal ? ` (signal ${signal})` : ""}`;
            emitWorkerEvent(
                key,
                "error",
                `worker exited before becoming ready (exit code ${code ?? "null"}${signal ? `, signal ${signal}` : ""})`,
                "worker-ready-failed",
                { exitCode: code, signal },
            );
        }

        void writeWorkersStatus();
        emitWorkerEvent(
            key,
            code === 0 || runtime.intentionalStop ? "info" : "error",
            `worker exited with code ${code ?? "null"}${signal ? ` (signal ${signal})` : ""}`,
            "worker-exit",
            { exitCode: code, signal },
        );
    };

    worker = {
        id: workerId++,
        key,
        state: "stopped",
        exitCode: null,
        connect: false,
        ready: false,
        readyAttempts: 0,
        meta: {
            inspect: false,
        },
        kill: async () => {
            runtime.intentionalStop = true;
            if (worker.state === "stopped") return;
            cancelReadyProbe(key, worker, runtime);
            emitWorkerEvent(key, "info", "stop requested", "worker-stop-request");
            const child = runtime.spawnProcess;
            if (!child) {
                worker.state = "stopped";
                await writeWorkersStatus();
                return;
            }
            await Promise.all([
                new Promise<void>((resolve) => {
                    child.once("exit", () => resolve());
                }),
                (async () => {
                    try {
                        child.kill("SIGINT");
                        if (options.port) await killPort(options.port);
                    } catch {
                        // ignore
                    }
                })(),
            ]);
            worker.state = "stopped";
            await writeWorkersStatus();
        },
        run: async (meta?: CookbookOptions["projects"][keyof CookbookOptions["projects"]]["meta"]) => {
            if (worker.state === "running") return;
            if (meta) {
                worker.meta = {
                    ...worker.meta,
                    ...meta,
                };
            }
            runtime.starting = true;
            runtime.intentionalStop = false;
            try {
                if (options.port) await killPort(options.port);
            } catch {
                // ignore
            }
            try {
                const envMixed: NodeJS.ProcessEnv = { ...process.env, ...options.env, IS_COOKBOOK: "1" };
                if (worker.meta.inspect) envMixed.NODE_OPTIONS = "--inspect";
                // NOTE: do NOT pass windowsHide here. The background dev server
                // is launched with a hidden console (see start.ts), and child
                // processes must INHERIT that console. windowsHide maps to
                // CREATE_NO_WINDOW under Bun, which would leave this process
                // without a console and force its own children (npm.cmd -> cmd.exe,
                // node, ...) to each create a new visible console window.
                const child = spawn(platform === "win32" ? "powershell.exe" : "bash", ["-c", options.command], {
                    cwd: options.cwd,
                    env: envMixed,
                    stdio: ["ignore", options.stdout !== "ignore" ? "pipe" : "ignore", "pipe"],
                });
                runtime.spawnProcess = child;

                const handleStreamError = (error: Error) => {
                    emitWorkerEvent(key, "error", `stream error: ${formatError(error)}`, "worker-stream-error");
                    handleExit(1, null);
                };

                if (child.stdout) {
                    child.stdout.on("data", (chunk: Buffer) => handleMessage(worker, key, chunk, "stdout")).on("error", handleStreamError);
                }
                if (child.stderr) {
                    child.stderr.on("data", (chunk: Buffer) => handleMessage(worker, key, chunk, "stderr")).on("error", handleStreamError);
                }
                child.on("error", (error) => {
                    emitWorkerEvent(key, "error", `spawn error: ${formatError(error)}`, "worker-spawn-error");
                    handleExit(null, null);
                });
                child.on("exit", (code, signal) => handleExit(code, signal));

                worker.state = "running";
                worker.exitCode = null;
                worker.ready = false;
                worker.readyAt = undefined;
                worker.readyMs = undefined;
                worker.readyAttempts = 0;
                worker.readyError = undefined;
                runtime.starting = false;
                runtime.started = true;

                emitWorkerEvent(key, "info", `worker spawned: ${options.command}`, "worker-spawn", { command: options.command });
                emitWorkerEvent(key, "info", "worker running", "worker-running");
                void writeWorkersStatus();

                if (options.connectTestUrl) {
                    startReadyProbe(worker, runtime, key, options.connectTestUrl);
                } else {
                    worker.readyError = "connectTestUrl is not defined";
                    void writeWorkersStatus();
                    emitWorkerEvent(key, "error", "cannot probe readiness: connectTestUrl is not defined", "worker-ready-failed");
                }
            } catch (error) {
                runtime.starting = false;
                runtime.started = true;
                emitWorkerEvent(key, "error", `spawn failed: ${formatError(error)}`, "worker-spawn-error");
                handleExit(1, null);
            }
        },
        testConnect: async (timeout?: number) => {
            const connectTestUrl = options.connectTestUrl;
            if (!connectTestUrl) {
                worker.connect = false;
                return {
                    success: false,
                    error: "connectTestUrl is not defined",
                };
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout ?? 4096);
            try {
                const response = await fetch(connectTestUrl, {
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (response.status >= 500) {
                    worker.connect = false;
                    return {
                        success: false,
                        error: `The HTTP status code is ${response.status}.`,
                    };
                }
                worker.connect = true;
                return {
                    success: true,
                };
            } catch (error: any) {
                clearTimeout(timeoutId);
                if (error instanceof Error && error.name === "AbortError") {
                    worker.connect = false;
                    return {
                        success: false,
                        error: "The request timed out.",
                    };
                }
                worker.connect = false;
                return {
                    success: false,
                    error: (error?.toString() ?? JSON.stringify(error)) || "Unknown error",
                };
            }
        },
    };

    return worker;
}

const textDecoder = new TextDecoder();

function handleMessage(worker: Worker, key: string, chunk: Buffer, type: "stdout" | "stderr"): void {
    const collector = getLogCollector();
    try {
        collector?.record(`worker:${key}`, type, chunk);
    } catch {
        // ignore
    }

    const runtime = runtimes.get(key);
    let strRaw: string;
    if (runtime) {
        const decoder = type === "stdout" ? (runtime.stdoutDecoder ??= new TextDecoder()) : (runtime.stderrDecoder ??= new TextDecoder());
        strRaw = decoder.decode(chunk);
    } else {
        strRaw = textDecoder.decode(chunk);
    }

    const prefix = outputPrefix(key, worker.id);
    const text = replaceNewlines(strRaw, prefix);
    if (collector) {
        try {
            collector.writeTerminal(type === "stderr" ? "stderr" : "stdout", text);
            return;
        } catch {
            // fall through to stdout
        }
    }
    stdout.write(text);
}

function replaceNewlines(str: string, prefix: string): string {
    const parts = str.split("\n");
    const newlineCount = parts.length - 1;

    if (newlineCount <= 1) {
        return `${prefix}${str}`;
    }

    const processed = `${parts.slice(0, -1).join(`\n${prefix}`)}\n${parts[parts.length - 1]}`;
    return `${prefix}${processed}`;
}

/**
 * In-process readiness wait used by the background test process before running
 * the actual test command. Resolves when every started worker is ready; fails
 * on a stopped worker, a `readyError` or the overall timeout.
 */
export async function waitForWorkersReady(timeoutMs = DEFAULT_READY_TIMEOUT_MS): Promise<WorkersReadyResult> {
    const ready: Record<string, WorkersReadyEntry> = {};
    const deadline = Date.now() + timeoutMs;

    while (true) {
        const pending: Array<string> = [];
        for (const [key, worker] of workers) {
            const runtime = runtimes.get(key);
            if (runtime && runtime.autoStart === false) continue;
            if (worker.ready) {
                ready[key] = {
                    readyMs: worker.readyMs,
                    attempts: worker.readyAttempts,
                    url: runtime?.readyUrl,
                };
                continue;
            }
            pending.push(key);
            if (worker.readyError) {
                const error =
                    worker.readyError === "timeout"
                        ? `Project "${key}" did not become ready before the readiness timeout.`
                        : `The dev server process of project "${key}" failed to become ready: ${worker.readyError}`;
                return { success: false, error, ready };
            }
            if (runtime?.started && !runtime.starting && worker.state === "stopped") {
                return {
                    success: false,
                    error: `The dev server process of project "${key}" exited before becoming ready.`,
                    ready,
                };
            }
        }

        if (pending.length === 0) return { success: true, ready };
        if (Date.now() >= deadline) {
            return { success: false, error: `Timed out waiting for projects: ${pending.join(", ")}`, ready };
        }
        await sleep(READY_PROBE_INTERVAL_MS);
    }
}
