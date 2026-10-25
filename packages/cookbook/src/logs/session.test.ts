import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import {
    createSession,
    enforceRetention,
    finalizeSession,
    getCurrentPointerPath,
    getLogsRoot,
    getSessionDir,
    isSessionRunning,
    listSessions,
    readCurrentSession,
    resolveSessionSelection,
    setLogsRoot,
    writeCurrentSession,
} from "./session";

let root: string;
const savedEnv = { ...process.env };

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "cookbook-logs-"));
    setLogsRoot(root);
    process.env = { ...savedEnv };
});

afterEach(() => {
    setLogsRoot(undefined);
    process.env = { ...savedEnv };
    rmSync(root, { recursive: true, force: true });
});

function writeSegment(sessionId: string, name: string, size: number): string {
    const dir = getSessionDir(sessionId);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, name);
    writeFileSync(path, "x".repeat(size), "utf-8");
    const old = new Date(Date.now() - 60_000);
    utimesSync(path, old, old);
    return path;
}

describe("session lifecycle", () => {
    test("createSession writes meta + current pointer", () => {
        const meta = createSession({ mode: "test", sessionId: "1761063001123" });
        expect(meta.sessionId).toBe("1761063001123");
        expect(meta.status).toBe("running");
        expect(existsSync(join(getSessionDir(meta.sessionId), "meta.json"))).toBe(true);
        expect(readCurrentSession()?.sessionId).toBe(meta.sessionId);
    });

    test("default selection is the current running session, then the last one", () => {
        const meta = createSession({ mode: "test", sessionId: "1761063001123" });
        let selection = resolveSessionSelection();
        expect(selection.kind).toBe("current");
        expect(selection.sessions[0].meta.sessionId).toBe(meta.sessionId);
        expect(selection.sessions[0].running).toBe(true);

        finalizeSession(meta.sessionId, "ended");
        expect(readCurrentSession()).toBeUndefined();

        const last = createSession({ mode: "test", sessionId: "1761063005123" });
        finalizeSession(last.sessionId, "ended");
        selection = resolveSessionSelection();
        expect(selection.kind).toBe("last");
        expect(selection.sessions[0].meta.sessionId).toBe(last.sessionId);
        expect(selection.sessions[0].running).toBe(false);
    });

    test("index / id / all selections", () => {
        const first = createSession({ sessionId: "1761063001123" });
        finalizeSession(first.sessionId, "ended");
        const second = createSession({ sessionId: "1761063005123" });
        finalizeSession(second.sessionId, "ended");

        expect(resolveSessionSelection({ session: "1" }).sessions[0].meta.sessionId).toBe(second.sessionId);
        expect(resolveSessionSelection({ session: "2" }).sessions[0].meta.sessionId).toBe(first.sessionId);
        expect(resolveSessionSelection({ session: "1761063001" }).sessions[0].meta.sessionId).toBe(first.sessionId);
        expect(resolveSessionSelection({ session: "all" }).sessions).toHaveLength(2);
        expect(() => resolveSessionSelection({ session: "3" })).toThrow(/does not exist/);
        expect(() => resolveSessionSelection({ session: "nope" })).toThrow(/does not exist/);
    });

    test("isSessionRunning only trusts the current pointer + live pid", () => {
        const meta = createSession({ sessionId: "1761063001123" });
        expect(isSessionRunning(meta.sessionId)).toBe(true);
        expect(isSessionRunning("9999999999999")).toBe(false);
        writeCurrentSession({ ...meta, pid: 999_999 });
        expect(isSessionRunning(meta.sessionId)).toBe(false);
    });

    test("stale current pointer falls back to the newest session and is reported as crashed", () => {
        const meta = createSession({ sessionId: "1761063001123" });
        writeCurrentSession({ ...meta, pid: 999_999 });
        const sessions = listSessions();
        expect(sessions[0].running).toBe(false);
        expect(sessions[0].meta.status).toBe("crashed");
        expect(resolveSessionSelection().kind).toBe("last");
    });

    test("corrupt current pointer falls back to the newest session", () => {
        createSession({ sessionId: "1761063001123" });
        writeFileSync(getCurrentPointerPath(), "not json", "utf-8");
        expect(readCurrentSession()).toBeUndefined();
        expect(resolveSessionSelection().sessions[0].meta.sessionId).toBe("1761063001123");
    });

    test("session ids are unique even within the same millisecond", () => {
        const a = createSession({ sessionId: "1761063001123" });
        const b = createSession({ sessionId: "1761063001123" });
        expect(a.sessionId).not.toBe(b.sessionId);
        expect(b.sessionId).toBe("1761063001123-1");
    });

    test("legacy flat log files are cleaned up", () => {
        mkdirSync(getLogsRoot(), { recursive: true });
        const legacy = join(getLogsRoot(), "1761063001123.log");
        writeFileSync(legacy, "old", "utf-8");
        createSession({ sessionId: "1761063005123" });
        expect(existsSync(legacy)).toBe(false);
    });
});

describe("retention", () => {
    test("evicts the oldest sessions beyond the max session count", () => {
        process.env.COOKBOOK_LOG_MAX_SESSIONS = "1";
        const a = createSession({ sessionId: "1761063001123" });
        finalizeSession(a.sessionId, "ended");
        const b = createSession({ sessionId: "1761063005123" });
        expect(existsSync(getSessionDir(a.sessionId))).toBe(false);
        expect(existsSync(getSessionDir(b.sessionId))).toBe(true);
    });

    test("evicts the oldest sessions beyond the total size", () => {
        process.env.COOKBOOK_LOG_MAX_BYTES = "1000";
        process.env.COOKBOOK_LOG_MAX_SESSIONS = "100";
        const a = createSession({ sessionId: "1761063001123" });
        finalizeSession(a.sessionId, "ended");
        writeSegment(a.sessionId, "1-000001.jsonl", 600);
        const b = createSession({ sessionId: "1761063005123" });
        writeSegment(b.sessionId, "1-000001.jsonl", 600);
        enforceRetention({ force: true });
        expect(existsSync(getSessionDir(a.sessionId))).toBe(false);
        expect(existsSync(getSessionDir(b.sessionId))).toBe(true);
    });

    test("trims the oldest segments of the current session", () => {
        process.env.COOKBOOK_LOG_MAX_SESSION_BYTES = "1000";
        const meta = createSession({ sessionId: "1761063001123" });
        writeSegment(meta.sessionId, "1-000001.jsonl", 600);
        writeSegment(meta.sessionId, "1-000002.jsonl", 600);
        enforceRetention({ force: true });
        const segments = readdirSync(getSessionDir(meta.sessionId)).filter((name) => name.endsWith(".jsonl"));
        expect(segments).toHaveLength(1);
        expect(segments[0]).toBe("1-000002.jsonl");
    });

    test("never deletes the active segment", () => {
        process.env.COOKBOOK_LOG_MAX_SESSION_BYTES = "1000";
        const meta = createSession({ sessionId: "1761063001123" });
        const active = writeSegment(meta.sessionId, "1-000001.jsonl", 600);
        writeSegment(meta.sessionId, "1-000002.jsonl", 600);
        enforceRetention({ force: true, activeFile: active });
        expect(existsSync(active)).toBe(true);
    });
});
