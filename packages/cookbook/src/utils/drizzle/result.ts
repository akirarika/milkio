import consola from "consola";
import type { Decision } from "./decisions";

export type DrizzleStatus =
    | "generated"
    | "no_changes"
    | "migrated"
    | "pushed"
    | "introspected"
    | "checked"
    | "upgraded"
    | "exported"
    | "decisions_required"
    | "failed";

export type DrizzleDatabaseSummary = {
    protocol?: string;
    host?: string;
    database?: string;
};

export type DrizzleJsonResult = {
    ok: boolean;
    status: DrizzleStatus;
    command: string;
    project?: string;
    mode?: string;
    database?: DrizzleDatabaseSummary;
    migrations?: Array<{ tag: string; file: string; sql: string }>;
    autoMigrate?: { ran: boolean; exitCode: number | null };
    fingerprint?: string;
    decisions?: Decision[];
    resume?: string;
    next?: string;
    note?: string;
    output?: string;
    error?: string;
};

/** Human-readable progress + machine-readable (stderr) progress for `--json`. */
export type Reporter = {
    json: boolean;
    log: (message: string) => void;
    success: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    childOutput: (chunk: string) => void;
};

export function createReporter(json: boolean): Reporter {
    const toStderr = (prefix: string, message: string) => {
        process.stderr.write(`${prefix}${message}\n`);
    };
    return {
        json,
        log: (message) => (json ? toStderr("", message) : consola.info(message)),
        success: (message) => (json ? toStderr("", message) : consola.success(message)),
        warn: (message) => (json ? toStderr("[warn] ", message) : consola.warn(message)),
        error: (message) => (json ? toStderr("[error] ", message) : consola.error(message)),
        childOutput: (chunk) => (json ? process.stderr.write(chunk) : process.stdout.write(chunk)),
    };
}

/** Extract a redacted database summary from a connection URL. */
export function summarizeDatabase(url: string | undefined): DrizzleDatabaseSummary | undefined {
    if (!url) return undefined;
    try {
        const parsed = new URL(url);
        return {
            protocol: parsed.protocol.replace(/:$/, ""),
            host: parsed.host || undefined,
            database: parsed.pathname.replace(/^\//, "") || undefined,
        };
    } catch {
        return { database: url.includes("@") ? url.slice(url.lastIndexOf("@") + 1) : undefined };
    }
}

/** Redirect everything written to stdout into stderr while `run` executes. */
export async function withStdoutRedirect<T>(run: () => Promise<T>): Promise<T> {
    const originalWrite = process.stdout.write.bind(process.stdout);
    const stderrWrite = process.stderr.write.bind(process.stderr);
    process.stdout.write = stderrWrite as typeof process.stdout.write;
    try {
        return await run();
    } finally {
        process.stdout.write = originalWrite;
    }
}

export function emitJson(result: DrizzleJsonResult): void {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
