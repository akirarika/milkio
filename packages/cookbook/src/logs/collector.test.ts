import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { getLogCollector, installLogCollector, writeSessionEvent, type InstallLogCollectorOptions, type LogCollector } from "./collector";
import { createSession, getCurrentPointerPath, getSessionDir, getLogsRoot, readCurrentSession, readSessionMeta, setLogsRoot } from "./session";
import type { LogRecord } from "./types";

let root: string;
let sessionId: string;
let collector: LogCollector | undefined;

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "cookbook-collector-"));
    setLogsRoot(root);
    sessionId = createSession({ mode: "test", sessionId: "1761063001123" }).sessionId;
});

afterEach(() => {
    try {
        collector?.close();
    } catch {
        // ignore
    }
    collector = undefined;
    setLogsRoot(undefined);
    rmSync(root, { recursive: true, force: true });
});

function install(extra: Partial<InstallLogCollectorOptions> = {}): LogCollector {
    collector = installLogCollector({
        source: "co:test",
        sessionId,
        captureConsole: false,
        mirror: false,
        installProcessHooks: false,
        ...extra,
    });
    return collector;
}

function segmentNames(): Array<string> {
    try {
        return readdirSync(getSessionDir(sessionId))
            .filter((name) => name.endsWith(".jsonl"))
            .sort();
    } catch {
        return [];
    }
}

function readRecords(): Array<LogRecord> {
    const dir = getSessionDir(sessionId);
    const records: Array<LogRecord> = [];
    for (const name of segmentNames()) {
        const text = readFileSync(join(dir, name), "utf-8");
        for (const line of text.split("\n")) {
            if (!line) continue;
            try {
                records.push(JSON.parse(line) as LogRecord);
            } catch {
                // tolerate corrupt segments, exactly like the log viewer does
            }
        }
    }
    return records;
}

describe("LogCollector", () => {
    test("writes JSONL records with the documented shape and precomputed err", () => {
        const active = install();
        active.record("worker:api", "stdout", "hello world\n");
        active.record("worker:api", "stdout", "Error: kaput\n");
        active.record("worker:api", "stdout", "all good\n");
        active.record("worker:api", "stderr", "plain text\n");
        active.flushSync();

        const records = readRecords().filter((record) => record.source === "worker:api");
        expect(records).toHaveLength(4);
        expect(records[0]).toEqual({ ts: expect.any(Number), source: "worker:api", stream: "stdout", text: "hello world", err: false });
        expect(records[1].err).toBe(true);
        expect(records[2].err).toBe(false);
        expect(records[3]).toMatchObject({ stream: "stderr", err: true });

        const raw = readFileSync(join(getSessionDir(sessionId), segmentNames()[0]), "utf-8").trim().split("\n");
        expect(JSON.parse(raw[0])).toHaveProperty("ts");
    });

    test("initialises session metadata, current pointer and a session-start event", () => {
        const active = install();
        active.flushSync();
        expect(getLogCollector()).toBeDefined();
        const meta = readSessionMeta(sessionId);
        expect(meta.pid).toBe(process.pid);
        expect(meta.status).toBe("running");
        expect(readCurrentSession()?.sessionId).toBe(sessionId);
        const start = readRecords().find((record) => record.kind === "session-start");
        expect(start).toBeDefined();
        expect(start?.stream).toBe("system");
    });

    test("splits per source and keeps partial lines independent", () => {
        const active = install();
        active.record("worker:a", "stdout", "a1\npartial-");
        active.record("worker:b", "stdout", "b1\n");
        active.record("worker:a", "stdout", "done\n");
        active.flushSync();

        const records = readRecords();
        expect(records.filter((record) => record.source === "worker:a").map((record) => record.text)).toEqual(["a1", "partial-done"]);
        expect(records.filter((record) => record.source === "worker:b").map((record) => record.text)).toEqual(["b1"]);
    });

    test("strips ANSI, rewrites \\r lines and decodes UTF-8 split across chunks", () => {
        const active = install();
        active.record("worker:api", "stdout", "\x1b[31mred\x1b[0m\n");
        active.record("worker:api", "stdout", "progress 10%\rprogress 100%\n");
        const raw = Buffer.from("你好，世界\n", "utf-8");
        active.record("worker:api", "stdout", raw.subarray(0, 4));
        active.record("worker:api", "stdout", raw.subarray(4));
        active.flushSync();

        const texts = readRecords()
            .filter((record) => record.source === "worker:api")
            .map((record) => record.text);
        expect(texts).toEqual(["red", "progress 100%", "你好，世界"]);
    });

    test("flushes a trailing partial line on flushSync (process exit path)", () => {
        const active = install();
        active.record("worker:api", "stdout", "no newline at end");
        expect(readRecords().some((record) => record.text === "no newline at end")).toBe(false);
        active.flushSync();
        expect(readRecords().some((record) => record.text === "no newline at end")).toBe(true);
    });

    test("rotates segments at 512 KB and numbers them sequentially", () => {
        const active = install();
        const payload = `${"y".repeat(1000)}\n`;
        for (let index = 0; index < 600; index++) active.record("worker:big", "stdout", payload);
        active.flushSync();

        const names = segmentNames();
        expect(names.length).toBeGreaterThanOrEqual(2);
        expect(names[0]).toBe(`${process.pid}-000001.jsonl`);
        expect(names[1]).toBe(`${process.pid}-000002.jsonl`);

        const dir = getSessionDir(sessionId);
        let lines = 0;
        for (const name of names) {
            expect(statSync(join(dir, name)).size).toBeLessThanOrEqual(512 * 1024 + 2048);
            lines += readFileSync(join(dir, name), "utf-8").split("\n").filter(Boolean).length;
        }
        // 600 payload lines + the session-start event
        expect(lines).toBe(601);
    });

    test("tolerates a corrupt pre-existing segment without touching it", () => {
        const dir = getSessionDir(sessionId);
        const corruptPath = join(dir, `${process.pid}-000001.jsonl`);
        writeFileSync(corruptPath, "this is not json\n", "utf-8");

        const active = install();
        active.record("worker:api", "stdout", "after corrupt\n");
        active.flushSync();

        expect(readFileSync(corruptPath, "utf-8")).toBe("this is not json\n");
        expect(segmentNames()).toContain(`${process.pid}-000002.jsonl`);
        expect(readRecords().some((record) => record.text === "after corrupt")).toBe(true);
    });

    test("captures patched console writes and stays silent when mirror is false", () => {
        const active = install({ captureConsole: true, mirror: false, source: "co:test" });
        try {
            // note: process.stdout.write directly (vitest intercepts console.*)
            process.stdout.write("captured console line\n");
            process.stderr.write("captured stderr line\n");
            active.flushSync();
        } finally {
            active.close();
        }

        const records = readRecords().filter((record) => record.source === "co:test");
        expect(records.find((record) => record.text === "captured console line")?.stream).toBe("stdout");
        const stderrRecord = records.find((record) => record.text === "captured stderr line");
        expect(stderrRecord?.stream).toBe("stderr");
        expect(stderrRecord?.err).toBe(true);
    });

    test("writeTerminal bypasses capture", () => {
        const active = install({ captureConsole: true, mirror: false });
        try {
            active.writeTerminal("stdout", "terminal-bypass-line\n");
            active.flushSync();
        } finally {
            active.close();
        }
        expect(readRecords().some((record) => record.text.includes("terminal-bypass-line"))).toBe(false);
    });

    test("events are single-line system records with kind/meta", () => {
        const active = install();
        active.event("cookbook", "error", "line 1\nline 2", { kind: "boom", meta: { answer: 42 } });
        active.flushSync();

        const record = readRecords().find((item) => item.kind === "boom");
        expect(record).toMatchObject({
            source: "cookbook",
            stream: "system",
            text: "line 1 line 2",
            err: true,
            meta: { answer: 42 },
        });
    });

    test("imports the bootstrap log tail, capped at the newest 2000 lines", () => {
        const bootPath = join(getSessionDir(sessionId), "bootstrap-1761063001123.log");
        const lines = Array.from({ length: 2100 }, (_, index) => `boot-${index + 1}`);
        writeFileSync(bootPath, `${lines.join("\n")}\n`, "utf-8");

        const active = install({ bootstrapLogPath: bootPath });
        active.flushSync();

        const boot = readRecords().filter((record) => record.kind === "boot-import");
        expect(boot).toHaveLength(2000);
        expect(boot[0].source).toBe("cookbook:boot");
        expect(boot[0].text).toBe("boot-101");
        expect(boot[1999].text).toBe("boot-2100");
    });

    test("imports at most the last 1 MB of the bootstrap log", () => {
        const bootPath = join(getSessionDir(sessionId), "bootstrap-big.log");
        const lines = Array.from({ length: 1500 }, (_, index) => `line-${index + 1}-${"x".repeat(900)}`);
        writeFileSync(bootPath, `${lines.join("\n")}\n`, "utf-8");

        const active = install({ bootstrapLogPath: bootPath });
        active.flushSync();

        const boot = readRecords().filter((record) => record.kind === "boot-import");
        expect(boot.length).toBeLessThan(1500);
        expect(boot[0].text.startsWith("line-")).toBe(true);
        expect(boot[0].text).not.toBe(lines[0]);
        expect(boot[boot.length - 1].text.startsWith("line-1500-")).toBe(true);
    });

    test("records a piped child process' stdout/stderr streams", async () => {
        const active = install();
        await new Promise<void>((resolve, reject) => {
            const child = spawn(
                process.execPath,
                ["-e", "process.stdout.write('child stdout ok\\n'); process.stderr.write('child stderr boom\\n'); process.exit(0);"],
                { stdio: ["ignore", "pipe", "pipe"] },
            );
            child.stdout?.on("data", (chunk: Buffer) => active.record("child", "stdout", chunk));
            child.stderr?.on("data", (chunk: Buffer) => active.record("child", "stderr", chunk));
            child.on("error", reject);
            child.on("close", () => resolve());
        });
        active.flushSync();

        const records = readRecords().filter((record) => record.source === "child");
        expect(records.some((record) => record.text === "child stdout ok")).toBe(true);
        const stderrRecord = records.find((record) => record.text.includes("child stderr boom"));
        expect(stderrRecord?.stream).toBe("stderr");
        expect(stderrRecord?.err).toBe(true);
    });
});

describe("writeSessionEvent", () => {
    test("writes one structured record to another session (replaced run)", () => {
        const previous = createSession({ mode: "dev", sessionId: "1761063009999" });
        writeSessionEvent(previous.sessionId, { source: "co:start", stream: "system", text: "stopped by a new run", kind: "session-replaced" });

        const dir = getSessionDir(previous.sessionId);
        const names = readdirSync(dir).filter((name) => name.endsWith(".jsonl"));
        expect(names).toHaveLength(1);
        const record = JSON.parse(readFileSync(join(dir, names[0]), "utf-8").trim()) as LogRecord;
        expect(record).toMatchObject({
            source: "co:start",
            stream: "system",
            text: "stopped by a new run",
            kind: "session-replaced",
            err: false,
        });
        expect(typeof record.ts).toBe("number");
        expect(getLogsRoot()).toBe(root);
        expect(readFileSync(getCurrentPointerPath(), "utf-8")).toContain(previous.sessionId);
    });

    test("precomputes err for stderr records and never throws for unknown sessions", () => {
        writeSessionEvent("1761063011111", { source: "co:start", stream: "stderr", text: "plain text" });
        const dir = getSessionDir("1761063011111");
        const name = readdirSync(dir).find((entry) => entry.endsWith(".jsonl"));
        expect(name).toBeDefined();
        const record = JSON.parse(readFileSync(join(dir, name as string), "utf-8").trim()) as LogRecord;
        expect(record.err).toBe(true);

        expect(() => writeSessionEvent("", { source: "x", stream: "system", text: "y" })).not.toThrow();
    });
});
