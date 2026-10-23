import { consola } from "consola";
import { platform } from "node:process";
import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";
import * as readline from "node:readline";
import { getLogCollector } from "../logs/collector";

export type ExecScriptOptions = SpawnOptionsWithoutStdio & {
    /**
     * When set and a log collector is installed, the child's stdout/stderr are
     * recorded under this source and mirrored through the collector instead of
     * being piped into the (patched) parent console — this avoids double
     * capture.
     */
    logSource?: string;
};

/**
 * 执行脚本并返回退出码。调用方应检查返回值并决定如何处理失败。
 */
export async function execScript(script: string, options: ExecScriptOptions): Promise<number> {
    const { logSource, ...spawnOptions } = options;
    const shell = platform === "win32" ? "powershell.exe" : "bash";
    const shellOptions = platform === "win32" ? "-Command" : "-c";

    let scriptDisplay = script;
    if (platform === "win32") {
        // NOTE: 简单的字符串替换会破坏脚本字符串字面量中的 &&，
        // 但当前所有调用方传入的脚本都不含字面量 &&，因此可接受。
        scriptDisplay = `${script.replaceAll("&&", ";")}`;
    }

    consola.start(`${scriptDisplay}`);

    let scriptRaw = script;
    if (platform === "win32") {
        scriptRaw = `$ErrorActionPreference = "Stop"; ${script.replaceAll("&&", ";")}`;
    }
    scriptRaw = `"${scriptRaw.replaceAll('"', '\\"')}"`.trim();

    const child = spawn(shell, [shellOptions, scriptRaw], {
        ...spawnOptions,
        shell: true,
        stdio: "pipe",
        env: {
            ...process.env,
            ...spawnOptions.env,
            ...(process.stdout.isTTY
                ? {
                    TERM: process.env.TERM || "xterm-256color",
                    COLORTERM: process.env.COLORTERM || "1",
                }
                : {}),
        },
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
    });

    rl.on("line", (line) => {
        if (!child.stdin.destroyed) child.stdin.write(`${line}\n`);
    });

    const stdinDataHandler = (data: Buffer) => {
        if (!child.stdin.destroyed) {
            child.stdin.write(data);
        }
    };
    process.stdin.on("data", stdinDataHandler);

    const collector = logSource !== undefined ? getLogCollector() : undefined;
    if (collector && logSource !== undefined) {
        // record + mirror through the collector; do NOT pipe (the console is
        // patched in background processes, piping would capture twice)
        child.stdout?.on("data", (chunk: Buffer) => {
            try {
                collector.record(logSource, "stdout", chunk);
                collector.writeTerminal("stdout", chunk.toString("utf-8"));
            } catch {
                // logging must never break the child command
            }
        });
        child.stderr?.on("data", (chunk: Buffer) => {
            try {
                collector.record(logSource, "stderr", chunk);
                collector.writeTerminal("stderr", chunk.toString("utf-8"));
            } catch {
                // logging must never break the child command
            }
        });
    } else {
        child.stdout?.pipe(process.stdout);
        child.stderr?.pipe(process.stderr);
    }

    const handleSignal = (signal: NodeJS.Signals) => {
        if (!child.killed) {
            child.kill(signal);
        }
    };
    process.on("SIGINT", handleSignal);
    process.on("SIGTERM", handleSignal);

    try {
        return await new Promise<number>((resolve) => {
            child.on("exit", (code, signal) => {
                const exitCode = code !== null ? code : signal ? 1 : 0;
                if (exitCode !== 0) {
                    consola.fail(`Script failed with exit code ${exitCode}`);
                }
                resolve(exitCode);
            });
        });
    } finally {
        // 清理所有监听器，避免在长生命周期进程里累积监听器导致内存泄漏
        rl.close();
        if (!child.stdin.destroyed) child.stdin.end();
        process.stdin.removeListener("data", stdinDataHandler);
        process.removeListener("SIGINT", handleSignal);
        process.removeListener("SIGTERM", handleSignal);
    }
}

/**
 * 执行脚本，如果退出码非 0 则直接以该退出码结束进程。
 * 供不需要自定义错误处理的调用方使用。
 */
export async function execScriptOrFail(script: string, options: SpawnOptionsWithoutStdio): Promise<void> {
    const exitCode = await execScript(script, options);
    if (exitCode !== 0) {
        process.exit(exitCode);
    }
}
