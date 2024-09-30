import { join } from "node:path";
import { exit, cwd } from "node:process";
import { $, env, type Subprocess } from "bun";
import type { CookbookOptions } from "..";
import { emitter } from "../emitter";

const textDecoder = new TextDecoder();
export const workers = new Map<string, Worker>();

export type Worker = {
  key: string;
  stdout: Array<string>;
  state: "running" | "stopped";
  kill: () => void;
  run: () => void;
};

export const initWorkers = async (options: CookbookOptions) => {
  for (const projectName in options.projects) {
    const project = options.projects[projectName];
    createWorkers(projectName, { command: project.start, max: 0, cwd: join(cwd(), "projects", projectName) }).run();
  }
};

export const createWorkers = (key: string, options: { command: Array<string>; cwd: string; env?: Record<string, string>; stdout?: "ignore" | "pipe"; max?: number }): Worker => {
  options.env = { ...env, ...options.env } as Record<string, string>;
  options.env.MILKIO_DEVELOP = "ENABLE";

  const worker: Worker = {
    key,
    stdout: [] as Array<string>,
    state: "stopped",
    kill: () => {
      if (worker.state === "stopped") return;
      spawn.kill(1);
      emitter.emit("data", { type: "workers@state", key, state: "stopped", code: "kill" });
      worker.state = "stopped";
    },
    run: () => {
      if (worker.state === "running") return;
      spawn = Bun.spawn(options.command, {
        ...options,
        stdin: "ignore",
        stdout: options.stdout !== "ignore" ? "pipe" : "ignore",
        env: options.env,
        onExit: (_proc, _code, _signalCode, _error) => {
          if (_code !== 0 && options.stdout !== "ignore" && options.max !== 0) emitter.emit("data", { type: "workers@stdout", key, chunk: `\n-- code: ${_code}\n` });
          emitter.emit("data", { type: "workers@state", key, state: "stopped", code: _code });
          worker.state = "stopped";
        },
      });
      if (options.stdout !== "ignore") {
        spawn.stdout.pipeTo(
          new WritableStream({
            write: (chunk) => {
              const str = textDecoder.decode(chunk);
              void process.stdout.write(str);
              worker.stdout.push(str);
              if (options.max !== 0) emitter.emit("data", { type: "workers@stdout", key, chunk: str });
              if (worker.stdout.length >= (options.max ?? 1024 * 64)) worker.stdout.splice(0, Math.ceil((options.max ?? 1024 * 64) * 0.2));
            },
          }),
        );
      }

      emitter.emit("data", { type: "workers@state", key, state: "running", code: "running" });
      worker.state = "running";
    },
  };

  let spawn: Subprocess<"ignore", "pipe", "inherit">;
  workers.set(key, worker);

  return worker;
};
