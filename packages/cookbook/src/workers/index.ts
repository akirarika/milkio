import os from "node:os";
import { join } from "node:path";
import { cwd, stderr, stdout } from "node:process";
import { emitter } from "../emitter/index.ts";
import type { CookbookOptions } from "../utils/cookbook-dto-types.ts";
import { spawn, type ChildProcess } from "node:child_process";
import { env } from "bun";
import killPort from "kill-port";
import { getMode } from "../utils/get-mode.ts";

const platform = os.platform();
export const workers = new Map<string, Worker>();

export interface Worker {
  key: string;
  stdout: Array<[number, number, "stdout" | "stderr", string]>;
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

export async function initWorkers(options: CookbookOptions) {
  for (const projectName in options.projects) {
    const project = options.projects[projectName];
    const mode = getMode();
    const env: Record<string, string | undefined> = {};
    if (project.prisma) env.DATABASE_URL = project.prisma?.find((p) => p.mode === mode)?.databaseUrl ?? undefined;
    if (project.drizzle) env.DATABASE_URL = project.drizzle?.find((d) => d.mode === mode)?.databaseUrl ?? undefined;
    const worker = createWorker(projectName, {
      env,
      command: project.start ?? `${options.general.packageManager} run dev`,
      max: 0,
      cwd: join(cwd(), "projects", projectName),
      port: project.port,
      connectTestUrl: project?.connectTestUrl ?? (project.type !== "milkio" ? `http://localhost:${project.port}/` : `http://localhost:${project.port}/generate_204`),
    });
    workers.set(projectName, worker);
    if (project.autoStart) setTimeout(() => worker.run(), (project.autoStartDelay ?? 0) * 1000);
  }
}

let stdoutIndex = 0;

export function createWorker(
  key: string,
  options: {
    command: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdout?: "pipe" | "ignore";
    max?: number;
    connectTestUrl?: string;
    port?: number;
  },
): Worker {
  const textDecoder = new TextDecoder();
  let spawnProcess: ChildProcess | null = null;

  const handleExit = (code: number | null, signal: string) => {
    const message = `Process exited with:${code ?? null}`;
    worker.stdout.push([stdoutIndex++, Date.now(), "stdout", message]);
    if (code !== 0 && options.stdout !== "ignore" && options.max !== 0) {
      const message = `\n-- code: ${code ?? signal}\n`;
      emitter.emit("data", { type: "workers@stdout", key, chunk: message });
    }

    emitter.emit("data", { type: "workers@state", key, state: "stopped", code });
    worker.state = "stopped";
  };

  const worker: Worker = {
    key,
    stdout: [],
    state: "stopped",
    connect: false,
    meta: {
      inspect: false,
    },
    kill: async () => {
      if (worker.state === "stopped") return;
      emitter.emit("data", { type: "workers@state", key, state: "stopped", code: "kill" });
      if (!spawnProcess) return Promise.resolve();
      await Promise.all([
        new Promise((resolve) => {
          spawnProcess?.once("exit", () => resolve(undefined));
        }),
        (async () => {
          try {
            spawnProcess?.kill("SIGINT");
            if (options.port) await killPort(options.port);
          } catch (error) {}
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
      } catch (error) {}
      const message = `\n--------------------------------\n# Start ${key}\n--------------------------------`;
      emitter.emit("data", { type: "workers@stdout", key, chunk: message });
      worker.stdout.push([stdoutIndex++, Date.now(), "stdout", message]);
      try {
        const envMixed: Record<string, string> = { ...env, ...(options.env ?? {}), MILKIO_DEVELOP: "ENABLE" };
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

        const handleMessage = (chunk: ArrayBuffer) => {
          const str = textDecoder.decode(chunk);
          worker.stdout.push([stdoutIndex++, Date.now(), "stdout", str]);
          stdout.write(str);
          emitter.emit("data", { type: "workers@stdout", key, chunk: str });
          if (worker.stdout.length >= (options.max ?? 1024 * 64)) {
            worker.stdout.splice(0, Math.ceil((options.max ?? 1024 * 64) * 0.2));
          }
        };

        const handleError = (chunk: ArrayBuffer) => {
          const str = textDecoder.decode(chunk);
          worker.stdout.push([stdoutIndex++, Date.now(), "stderr", str]);
          stderr.write(str);
          emitter.emit("data", { type: "workers@stdout", key, chunk: str });
          if (worker.stdout.length >= (options.max ?? 1024 * 64)) {
            worker.stdout.splice(0, Math.ceil((options.max ?? 1024 * 64) * 0.2));
          }
        };

        if (spawnProcess.stdout) {
          spawnProcess.stdout.on("data", handleMessage).on("error", handleStreamError);
        }
        if (spawnProcess.stderr) {
          spawnProcess.stderr.on("data", handleError).on("error", handleStreamError);
        }
        spawnProcess
          .on("error", (err) => {
            console.error("Process error:", err);
            handleExit(null, "SIGERR");
          })
          .on("exit", handleExit);

        emitter.emit("data", { type: "workers@state", key, state: "running", code: "running" });
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
