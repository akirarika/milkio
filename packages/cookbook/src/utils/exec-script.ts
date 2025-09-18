import { consola } from "consola";
import { platform } from "node:process";
import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";
import * as readline from "node:readline";

export async function execScript(script: string, options: SpawnOptionsWithoutStdio) {
    const shell = platform === "win32" ? "powershell.exe" : "bash";
    const shellOptions = platform === "win32" ? "-Command" : "-c";

    let scriptDisplay = script;
    if (platform === "win32") {
        scriptDisplay = `${script.replaceAll("&&", ";")}`;
    }

    consola.start(`${scriptDisplay}`);

    let scriptRaw = script;
    if (platform === "win32") {
        scriptRaw = `$ErrorActionPreference = "Stop"; ${script.replaceAll("&&", ";")}`;
    }
    scriptRaw = `"${scriptRaw.replaceAll('"', '\\"')}"`.trim();

    const child = spawn(shell, [shellOptions, scriptRaw], {
        ...options,
        shell: true,
        stdio: "pipe",
        env: {
            ...process.env,
            ...options.env,
            ...(process.stdout.isTTY
                ? {
                    TERM: process.env.TERM || "xterm-256color",
                    COLORTERM: process.env.COLORTERM || "1",
                }
                : {}),
            ...options.env,
        },
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
    });

    rl.on("line", (line) => {
        child.stdin.write(`${line}\n`);
    });

    process.stdin.on("data", (data) => {
        if (!child.stdin.destroyed) {
            child.stdin.write(data);
        }
    });

    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);

    return await new Promise<number>((resolve) => {
        child.on("exit", (code, signal) => {
            rl.close();
            if (child.stdin.writable) child.stdin.end();

            resolve(code !== null ? code : signal ? 1 : 0);
        });

        const handleSignal = (signal: NodeJS.Signals) => {
            if (!child.killed) {
                child.kill(signal);
            }
        };
        process.on("SIGINT", handleSignal);
        process.on("SIGTERM", handleSignal);
    });
}
