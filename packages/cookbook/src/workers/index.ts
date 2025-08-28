import os from "node:os";
import { join } from "node:path";
import { cwd, stdout } from "node:process";
import type { CookbookOptions } from "../utils/cookbook-dto-types.ts";
import { spawn, type ChildProcess } from "node:child_process";
import { env } from "bun";
import killPort from "kill-port";
import { outputPrefix, setMaxNameLength } from "../utils/output-prefix.ts";
// import { useCookbookWorld } from "@milkio/cookbook-server";

const platform = os.platform();
let workerId = 1;
export const workers = new Map<string, Worker>();
export interface Worker {
    id: number;
    key: string;
    state: "running" | "stopped";
    connect: boolean;
    meta: CookbookOptions["projects"][keyof CookbookOptions["projects"]]["meta"];
    kill: () => Promise<void>;
    run: (meta?: CookbookOptions["projects"][keyof CookbookOptions["projects"]]["meta"]) => void;
    testConnect: (timeout?: number) => Promise<{
        success: boolean;
        error?: string;
    }>;
}

// const world = await useCookbookWorld();

export async function initWorkers(options: CookbookOptions, mode: string, baseUrl: string) {
    for (const projectName in options.projects) {
        const project = options.projects[projectName];
        const env: Record<string, string | undefined> = { MODE: mode, VITE_MODE: mode, NUXT_MODE: mode, COOKBOOK_MODE: mode, COOKBOOK_BASE_URL: baseUrl, MILKIO_PORT: `${project.port}` };
        const worker = createWorker(projectName, {
            env,
            command: project.start ?? `${options.general.packageManager} run dev`,
            cwd: join(cwd(), "projects", projectName),
            port: project.port,
            connectTestUrl: project?.connectTestUrl ?? (project.type !== "milkio" ? `http://localhost:${project.port}/` : `http://localhost:${project.port}/generate_204`),
        });
        workers.set(projectName, worker);
        if (project.autoStart) setTimeout(() => worker.run(), (project.autoStartDelay ?? 0) * 1000);
    }
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
    },
): Worker {
    let spawnProcess: ChildProcess | null = null;
    setMaxNameLength(key);

    const handleExit = (code: number | null, signal: string) => {
        // const message = `Process exited with:${code ?? null}`;
        if (code !== 0 && options.stdout !== "ignore") {
            // const message = `\n-- code: ${code ?? signal}\n`;
            // world.emit("cookbook:worker:log", { key, chunk: message, type: "stderr" });
        }

        // world.emit("cookbook:worker:state", { key, state: "stopped", code });
        worker.state = "stopped";
    };

    const worker: Worker = {
        id: workerId++,
        key,
        state: "stopped",
        connect: false,
        meta: {
            inspect: false,
        },
        kill: async () => {
            if (worker.state === "stopped") return;
            // world.emit("cookbook:worker:state", { key, state: "stopped", code: null });
            if (!spawnProcess) return Promise.resolve();
            await Promise.all([
                new Promise((resolve) => {
                    spawnProcess?.once("exit", () => resolve(undefined));
                }),
                (async () => {
                    try {
                        spawnProcess?.kill("SIGINT");
                        if (options.port) await killPort(options.port);
                    } catch (error) { }
                })(),
            ]);
            worker.state = "stopped";
        },
        run: async (meta?: CookbookOptions["projects"][keyof CookbookOptions["projects"]]["meta"]) => {
            if (worker.state === "running") return;
            if (meta) {
                worker.meta = {
                    ...worker.meta,
                    ...meta,
                };
            }
            try {
                if (options.port) await killPort(options.port);
            } catch (error) { }
            // const message = `\n--------------------------------\n# Start ${key}\n--------------------------------`;
            // world.emit("cookbook:worker:log", { key, chunk: message, type: "stdout" });
            try {
                const envMixed: Record<string, string> = { ...env, ...options.env, IS_COOKBOOK: "1" };
                if (worker.meta.inspect) envMixed.NODE_OPTIONS = "--inspect";
                spawnProcess = spawn(platform === "win32" ? "powershell.exe" : "bash", ["-c", options.command], {
                    cwd: options.cwd,
                    env: envMixed,
                    stdio: ["ignore", options.stdout !== "ignore" ? "pipe" : "ignore", "pipe"],
                });

                const handleStreamError = (err: Error) => {
                    console.error("Stream error:", err);
                    handleExit(1, "SIGERR");
                };

                if (spawnProcess.stdout) {
                    spawnProcess.stdout.on("data", (chunk) => handleMessage(worker, key, chunk, "stdout")).on("error", handleStreamError);
                }
                if (spawnProcess.stderr) {
                    spawnProcess.stderr.on("data", (chunk) => handleMessage(worker, key, chunk, "stderr")).on("error", handleStreamError);
                }
                spawnProcess
                    .on("error", (err) => {
                        console.error("Process error:", err);
                        handleExit(null, "SIGERR");
                    })
                    .on("exit", handleExit);

                // world.emit("cookbook:worker:state", { key, state: "running", code: null });
                worker.state = "running";
            } catch (err) {
                console.error("Spawn error:", err);
                handleExit(1, "SIGERR");
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
                    ...options,
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
            } catch (error) {
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
const handleMessage = (worker: Worker, key: string, chunk: ArrayBuffer, type: "stdout" | "stderr") => {
    const strRaw = textDecoder.decode(chunk);
    // oxlint-disable-next-line no-unused-vars, no-control-regex
    const str = strRaw.replace(/\x1b\[\d*;?]*m/g, "");

    const prefix = outputPrefix(key, worker.id);
    stdout.write(replaceNewlines(strRaw, prefix));

    // world.emit("cookbook:worker:log", { key, chunk: str, type });
};

function replaceNewlines(str: string, prefix: string): string {
    const parts = str.split("\n");
    const newlineCount = parts.length - 1;

    if (newlineCount <= 1) {
        return `${prefix}${str}`;
    }

    const processed = `${parts.slice(0, -1).join(`\n${prefix}`)}\n${parts[parts.length - 1]}`;
    return `${prefix}${processed}`;
}
