import { createWriteStream, existsSync, mkdirSync, rmSync, type WriteStream } from "node:fs";
import { join } from "node:path";
import { ensureCookbookDir, getLogsDir } from "./background";

// Rotate to a fresh log file once the current one grows beyond ~64kb.
const ROTATE_BYTES = 64 * 1024;

const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;

/**
 * Redirects the current process' stdout/stderr into rotating log files under
 * "<cwd>/node_modules/.cookbook/logs".
 *
 * Called by any command that starts a server and spawns child processes
 * (dev / test / start's background child). The log directory is cleared on
 * every start. When a single log file exceeds ~64kb, a new "<ms-timestamp>.log"
 * file is started and a marker line is appended to the old file pointing at the
 * new one. ANSI color codes are stripped before writing to disk.
 */
export function installBackgroundLogger(): void {
    ensureCookbookDir();
    const logsDir = getLogsDir();
    // each start begins with a clean logs directory
    rmSync(logsDir, { recursive: true, force: true });
    mkdirSync(logsDir, { recursive: true });

    let currentName = uniqueLogName(logsDir);
    let stream: WriteStream = createWriteStream(join(logsDir, currentName), { flags: "a" });
    let bytes = 0;

    const rotate = () => {
        const newName = uniqueLogName(logsDir);
        stream.end(`====================================\n✅ Subsequent logs have been switched to ./${newName}\n====================================\n`);
        currentName = newName;
        stream = createWriteStream(join(logsDir, currentName), { flags: "a" });
        bytes = 0;
    };

    const writeChunk = (chunk: unknown) => {
        const text = Buffer.isBuffer(chunk) ? chunk.toString() : typeof chunk === "string" ? chunk : String(chunk);
        const buffer = Buffer.from(text.replace(ANSI_RE, ""));
        if (bytes > 0 && bytes + buffer.length > ROTATE_BYTES) rotate();
        stream.write(buffer);
        bytes += buffer.length;
    };

    const originalOut = process.stdout.write.bind(process.stdout);
    const originalErr = process.stderr.write.bind(process.stderr);

    (process.stdout as any).write = (chunk: unknown, ...args: Array<unknown>) => {
        try {
            writeChunk(chunk);
        } catch {}
        return (originalOut as any)(chunk, ...args);
    };
    (process.stderr as any).write = (chunk: unknown, ...args: Array<unknown>) => {
        try {
            writeChunk(chunk);
        } catch {}
        return (originalErr as any)(chunk, ...args);
    };
}

function uniqueLogName(logsDir: string): string {
    let name = `${Date.now()}.log`;
    let suffix = 1;
    while (existsSync(join(logsDir, name))) {
        name = `${Date.now()}-${suffix++}.log`;
    }
    return name;
}
