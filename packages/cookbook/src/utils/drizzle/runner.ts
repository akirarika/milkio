import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { stripAnsi } from "../../logs/ansi";
import { whichSync } from "../node-compat";
import {
    answerKeystrokes,
    choiceFromAnswers,
    choiceFromPolicy,
    detectDecision,
    type AnswerSpec,
    type Decision,
    type PromptPolicy,
} from "./decisions";
import { UsageError } from "./errors";

/**
 * Loaded by the drizzle-kit child process via `node --require`.
 *
 * drizzle-kit refuses to render any prompt unless BOTH stdin and stdout are a
 * TTY (hanji's guard). The child's stdio is always a pipe under cookbook, so
 * without this shim rename/confirmation prompts are rejected outright and
 * drizzle-kit can silently skip the migration. The shim only touches the child
 * process it is preloaded into.
 */
const TTY_SHIM_SOURCE = `"use strict";
const stdin = process.stdin;
if (!stdin.isTTY) stdin.isTTY = true;
if (!process.stdout.isTTY) process.stdout.isTTY = true;
if (!process.stderr.isTTY) process.stderr.isTTY = true;
if (typeof stdin.setRawMode !== "function") stdin.setRawMode = function () {};
try { if (!process.stdout.columns) process.stdout.columns = 1000; } catch (error) {}
try { if (!process.stdout.rows) process.stdout.rows = 100; } catch (error) {}
try { if (!process.stderr.columns) process.stderr.columns = 1000; } catch (error) {}
`;

export type DrizzleRunOptions = {
    /** Absolute path to drizzle-kit's `bin.cjs`. */
    binPath: string;
    /** Arguments for drizzle-kit (subcommand + allowlisted flags). */
    args: string[];
    cwd: string;
    env?: Record<string, string | undefined>;
    /** When true, the child gets the real terminal (native prompts) instead of the shim. */
    interactive?: boolean;
    /** True for commands that can emit prompts (generate/push/drop). */
    promptCapable?: boolean;
    /** Output markers that mean the command finished successfully. */
    successMarkers?: RegExp[];
    /** Output markers that mean the run failed even if the exit code is 0. */
    failureMarkers?: RegExp[];
    answers?: AnswerSpec;
    policy?: PromptPolicy;
    /** Auto-approve confirmation prompts (drizzle-kit push `--force` semantics). */
    force?: boolean;
    onOutput?: (chunk: string) => void;
    timeoutMs?: number;
};

export type DrizzleRunFailure =
    | "failed"
    | "decisions_required"
    | "mismatch"
    | "invalid_choice"
    | "shim_failed"
    | "timeout"
    | "spawn";

export type DrizzleRunResult = {
    code: number | null;
    output: string;
    decisions: Decision[];
    usedChoices: number[];
    promptCount: number;
    /** True when a configured success marker was observed. */
    completed: boolean;
    aborted: boolean;
    failure?: DrizzleRunFailure;
    errorMessage?: string;
};

export type MigrationScriptOptions = {
    runtime: "node" | "bun";
    scriptPath: string;
    cwd: string;
    env?: Record<string, string | undefined>;
    onOutput?: (chunk: string) => void;
    timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const SETTLE_MS = 120;

/** Locate the drizzle-kit package bin from the project's module resolution. */
export function resolveDrizzleKitBin(projectPath: string): string {
    let entry: string;
    try {
        const require = createRequire(join(projectPath, "package.json"));
        entry = require.resolve("drizzle-kit");
    } catch {
        throw new UsageError(
            "Cannot resolve drizzle-kit for this project. Install drizzle-kit in the project (or the workspace root) and retry.",
        );
    }

    const packageRoot = dirname(entry);
    let binField: unknown;
    try {
        binField = (JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf-8")) as { bin?: unknown }).bin;
    } catch {
        throw new UsageError(`Cannot read drizzle-kit package.json at ${packageRoot}. Reinstall drizzle-kit and retry.`);
    }

    const relative = typeof binField === "string" ? binField : (binField as Record<string, string> | undefined)?.["drizzle-kit"];
    if (!relative) throw new UsageError(`drizzle-kit at ${packageRoot} does not declare a "drizzle-kit" bin.`);

    const binPath = resolve(packageRoot, relative);
    if (!existsSync(binPath)) throw new UsageError(`drizzle-kit bin not found at ${binPath}.`);
    return binPath;
}

/** Locate a Node.js executable able to run drizzle-kit. */
export function resolveNodeExecutable(): string | null {
    const own = basename(process.execPath).toLowerCase();
    if (own === "node" || own === "node.exe") return process.execPath;
    return whichSync("node");
}

function resolveRuntimeExecutable(runtime: "node" | "bun"): string {
    if (runtime === "node") {
        const node = resolveNodeExecutable();
        if (!node) throw new UsageError("Node.js was not found on PATH; it is required to run drizzle migrations.");
        return node;
    }
    const bun = whichSync("bun");
    if (!bun) throw new UsageError("Bun was not found on PATH; choose a project runtime that is installed.");
    return bun;
}

let cachedShimPath: string | null = null;

async function ensureTtyShim(): Promise<string> {
    if (cachedShimPath) return cachedShimPath;
    const hash = createHash("sha256").update(TTY_SHIM_SOURCE).digest("hex").slice(0, 12);
    const target = join(tmpdir(), `co-drizzle-tty-shim-${hash}.cjs`);
    // Content-addressed file name; rewriting is harmless and avoids ever
    // reusing a truncated shim left behind by a crashed earlier process.
    try {
        await writeFile(target, TTY_SHIM_SOURCE, { encoding: "utf-8" });
    } catch (error) {
        throw new UsageError(`Cannot write the drizzle-kit TTY shim to ${target}: ${(error as Error)?.message ?? error}`);
    }
    cachedShimPath = target;
    return target;
}

function buildEnv(extra?: Record<string, string | undefined>): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env, ...extra, NO_COLOR: "1", FORCE_COLOR: "0" };
    for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
    return env;
}

/**
 * Run drizzle-kit.
 *
 * In intercept mode the child's stdio is piped, promatable output is parsed into
 * decisions and answers are injected as keystrokes. Any prompt that cannot be
 * answered aborts the child *before* it writes anything.
 */
export async function runDrizzle(options: DrizzleRunOptions): Promise<DrizzleRunResult> {
    const nodeExecutable = resolveNodeExecutable();
    if (!nodeExecutable) {
        throw new UsageError(
            "Non-interactive drizzle execution requires Node.js on PATH (drizzle-kit is a Node CLI). Install Node.js and retry.",
        );
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const spawnArgs = options.interactive
        ? [options.binPath, ...options.args]
        : ["--require", await ensureTtyShim(), options.binPath, ...options.args];

    const child = spawn(nodeExecutable, spawnArgs, {
        cwd: options.cwd,
        env: buildEnv(options.env),
        stdio: options.interactive ? "inherit" : ["pipe", "pipe", "pipe"],
        windowsHide: true,
    });

    if (options.interactive) {
        return await new Promise<DrizzleRunResult>((resolveRun) => {
            child.on("error", (error) =>
                resolveRun(baseResult(null, [], [], false, "spawn", error.message)),
            );
            child.on("close", (code) => resolveRun(baseResult(code, [], [], false, code === 0 ? undefined : "failed")));
        });
    }

    // A write/end that races the child's exit emits EPIPE; without a handler it
    // would crash the CLI instead of returning the JSON/exit-code contract.
    child.stdin?.on("error", () => {});

    return await new Promise<DrizzleRunResult>((resolveRun) => {
        let raw = "";
        let lastCleanLength = 0;
        let settled = false;
        let aborted = false;
        let abortFailure: DrizzleRunFailure = "decisions_required";
        let markerFailure: DrizzleRunFailure | undefined;
        let completed = false;
        let promptCount = 0;
        let cooldownUntil = 0;
        const decisions: Decision[] = [];
        const usedChoices: number[] = [];
        let lastAnsweredDigest: string | null = null;
        let lastAnsweredAt = 0;

        let settleTimer: NodeJS.Timeout | undefined;
        let endStdinTimer: NodeJS.Timeout | undefined;
        let killFallbackTimer: NodeJS.Timeout | undefined;
        const hardTimer = setTimeout(() => {
            if (settled) return;
            markerFailure = "timeout";
            requestKill();
        }, timeoutMs);

        const clearTimers = () => {
            if (settleTimer) clearTimeout(settleTimer);
            if (endStdinTimer) clearTimeout(endStdinTimer);
            if (killFallbackTimer) clearTimeout(killFallbackTimer);
            clearTimeout(hardTimer);
        };

        const finish = (code: number | null) => {
            if (settled) return;
            settled = true;
            clearTimers();
            if (child.stdin && !child.stdin.destroyed) child.stdin.end();
            const failure = aborted ? abortFailure : markerFailure ?? (code === 0 ? undefined : "failed");
            resolveRun({
                code,
                output: raw,
                decisions,
                usedChoices,
                promptCount,
                completed,
                aborted,
                failure,
            });
        };

        const requestKill = () => {
            try {
                child.kill("SIGTERM");
            } catch {
                // ignore
            }
            if (killFallbackTimer) clearTimeout(killFallbackTimer);
            killFallbackTimer = setTimeout(() => {
                if (settled) return;
                try {
                    child.kill("SIGKILL");
                } catch {
                    // ignore
                }
                finish(null);
            }, 1500);
        };

        const endStdinSoon = () => {
            if (endStdinTimer) return;
            endStdinTimer = setTimeout(() => {
                if (!settled && child.stdin && !child.stdin.destroyed) child.stdin.end();
            }, 300);
        };

        const abort = (reason: DrizzleRunFailure) => {
            if (aborted) return;
            aborted = true;
            abortFailure = reason;
            requestKill();
        };

        const analyze = () => {
            if (settled || aborted) return;
            if (options.promptCapable !== true) return;
            if (Date.now() < cooldownUntil) {
                scheduleAnalyze(cooldownUntil - Date.now() + 60);
                return;
            }

            const decision = detectDecision(raw);
            if (!decision) return;

            // hanji redraws the same prompt (e.g. after the selection moves), so
            // ignore an identical digest for a short window after answering.
            // After that window a genuinely repeated prompt is answered again
            // instead of hanging until the timeout.
            if (decision.digest === lastAnsweredDigest && Date.now() - lastAnsweredAt < 1500) return;

            decision.index = promptCount;
            decisions.push(decision);

            let optionIndex: number | null = null;
            if (options.force === true && decision.kind === "confirm") {
                optionIndex = decision.options.find((option) => option.choice === "yes")?.index ?? null;
                if (optionIndex === null) return abort("decisions_required");
            } else if (options.policy) {
                // `--on-prompt` is documented as a single-prompt shortcut: a second
                // prompt means the schema change is more ambiguous than the caller
                // assumed, so it must be reviewed explicitly.
                if (promptCount > 0) return abort("decisions_required");
                optionIndex = choiceFromPolicy(decision, options.policy);
                if (optionIndex === null) return abort("decisions_required");
            } else if (options.answers) {
                const expectedDigest = options.answers.digests[decision.index];
                if (expectedDigest !== undefined && expectedDigest !== decision.digest) return abort("mismatch");
                optionIndex = choiceFromAnswers(decision, options.answers, decision.index);
                if (optionIndex === null) return abort("decisions_required");
            } else {
                return abort("decisions_required");
            }

            promptCount += 1;
            const stdin = child.stdin;
            if (!stdin || stdin.destroyed) return abort("spawn");
            stdin.write(answerKeystrokes(optionIndex));
            usedChoices.push(optionIndex);
            lastAnsweredDigest = decision.digest;
            lastAnsweredAt = Date.now();
            cooldownUntil = Date.now() + 180;
            scheduleAnalyze(220);
        };

        const scheduleAnalyze = (delay = SETTLE_MS) => {
            if (settleTimer) clearTimeout(settleTimer);
            settleTimer = setTimeout(analyze, delay);
        };

        const onChunk = (chunk: Buffer) => {
            raw += chunk.toString("utf-8");

            const clean = stripAnsi(raw);
            if (clean.length > lastCleanLength) {
                const delta = clean.slice(lastCleanLength);
                lastCleanLength = clean.length;
                if (delta && options.onOutput) options.onOutput(delta);
            } else if (clean.length < lastCleanLength) {
                lastCleanLength = clean.length;
            }

            if (!completed) {
                for (const marker of options.successMarkers ?? []) {
                    if (marker.test(clean)) {
                        completed = true;
                        endStdinSoon();
                        break;
                    }
                }
            }
            if (!markerFailure) {
                for (const marker of options.failureMarkers ?? []) {
                    if (marker.test(clean)) {
                        markerFailure = "shim_failed";
                        endStdinSoon();
                        break;
                    }
                }
            }

            if (options.promptCapable === true) scheduleAnalyze();
        };

        child.stdout?.on("data", onChunk);
        child.stderr?.on("data", onChunk);
        child.on("error", (error) => {
            markerFailure ??= "spawn";
            finish(null);
            if (options.onOutput) options.onOutput(`\n[co drizzle] failed to start drizzle-kit: ${error.message}\n`);
        });
        // `close` (not `exit`) guarantees the final stdout/stderr chunks were
        // delivered, so success markers and exported SQL are never missed.
        child.on("close", (code) => finish(code));

        if (options.promptCapable !== true) {
            // These commands never prompt; the shim's keypress listener would keep
            // the child alive forever while stdin stays open.
            endStdinSoon();
        }

        if (options.promptCapable === true) scheduleAnalyze(250);
    });
}

/** Run the project's own `drizzle.migrate.ts` script with output capture. */
export async function runMigrationScript(options: MigrationScriptOptions): Promise<{ code: number | null; output: string }> {
    const executable = resolveRuntimeExecutable(options.runtime);
    return await new Promise((resolveRun) => {
        const child = spawn(executable, [options.scriptPath], {
            cwd: options.cwd,
            env: buildEnv(options.env),
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
        });

        let output = "";
        const onChunk = (chunk: Buffer) => {
            const text = chunk.toString("utf-8");
            output += text;
            if (options.onOutput) options.onOutput(stripAnsi(text));
        };
        child.stdout?.on("data", onChunk);
        child.stderr?.on("data", onChunk);

        let settled = false;
        let killTimer: NodeJS.Timeout | undefined;
        const done = (code: number | null) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (killTimer) clearTimeout(killTimer);
            resolveRun({ code, output });
        };

        const timeout = setTimeout(() => {
            try {
                child.kill("SIGTERM");
            } catch {
                // ignore
            }
            killTimer = setTimeout(() => {
                try {
                    child.kill("SIGKILL");
                } catch {
                    // ignore
                }
                done(null);
            }, 1500);
        }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

        child.on("error", () => done(null));
        child.on("close", (code) => done(code));
    });
}

function baseResult(
    code: number | null,
    decisions: Decision[],
    usedChoices: number[],
    aborted: boolean,
    failure?: DrizzleRunFailure,
    errorMessage?: string,
): DrizzleRunResult {
    return {
        code,
        output: "",
        decisions,
        usedChoices,
        promptCount: usedChoices.length,
        completed: false,
        aborted,
        failure,
        errorMessage,
    };
}
