import { search } from "@inquirer/prompts";
import { argv, cwd, exit } from "node:process";
import consola from "consola";
import { join } from "node:path";
import { exists, mkdir, writeFile } from "node:fs/promises";
import { readdir, readFile } from "node:fs/promises";
import { env } from "bun";
import { getCookbookToml } from "./utils/get-cookbook-toml";
import { __router__ } from "./commands/__router__";
import { uniqWith } from "lodash-es";
import { progress } from "./progress";
import { fetchEventSource } from "./utils/fetch-event-source";
import { execScript } from "./utils/exec-script";

type Params = {
  command: string;
  commands: Array<string>;
  options: Record<string, string | true>;
  raw: Array<string>;
};

export async function cookbook() {
  const params: Params = {
    command: "index",
    commands: [],
    options: {},
    raw: [],
  };
  params.raw = argv.slice(3);

  for (const v of argv.slice(3)) {
    if (v.startsWith("--") && v.includes("=")) {
      const vSplited = v.split("=");
      params.options[vSplited[0].slice(2)] = vSplited.slice(1, vSplited.length).join("=");
    } else if (v.startsWith("--")) {
      params.options[v.slice(2)] = "1";
    } else if (v.startsWith("-") && v.includes("=")) {
      const vSplited = v.split("=");
      params.options[vSplited[0].slice(1)] = vSplited.slice(1, vSplited.length).join("=");
    } else if (v.startsWith("-")) {
      params.options[v.slice(1)] = "1";
    } else {
      params.commands.push(v);
    }
  }
  if (argv.length === 2) params.command = "index";
  if (argv.length !== 2) params.command = `${argv[2] ?? "index"}`;
  if (params.command.startsWith("--")) params.command = params.command.slice(2);
  if (params.command.startsWith("-") && params.command !== "-") params.command = params.command.slice(1);

  const packageJson = (await exists(join(cwd(), "package.json"))) ? JSON.parse(await readFile(join(cwd(), "package.json"), "utf-8")) : undefined;
  exists(join(env.HOME || env.USERPROFILE || "/", ".commands"));
  if (!(await exists(join(env.HOME || env.USERPROFILE || "/", ".commands")))) await mkdir(join(env.HOME || env.USERPROFILE || "/", ".commands"));
  if (!(await exists(join(env.HOME || env.USERPROFILE || "/", ".commands", "package.json"))))
    await writeFile(join(env.HOME || env.USERPROFILE || "/", ".commands", "package.json"), JSON.stringify({ name: "commands", private: true, scripts: {}, dependencies: { "@milkio/cookbook-command": "*" }, devDependencies: {} }, null, 2));

  if (params.command === "index") {
    const commands = [
      {
        name: "<cancel>",
        value: "<cancel>",
        description: "built-in",
      },
    ] as Array<{ name: string; value: string; path?: string; description?: "global" | "npm-script" | "workspace" | "built-in" }>;

    for (const command of __router__) {
      if (command.hidden !== true) commands.push({ name: command.commands[0], value: command.commands[0], description: "built-in" });
    }

    if (await exists(join(cwd(), "package.json"))) {
      const packageJson = JSON.parse(await readFile(join(cwd(), "package.json"), "utf-8"));
      for (const key in packageJson?.scripts ?? {}) {
        commands.push({ name: key, value: key, path: key, description: "npm-script" });
      }
    }

    if (await exists(join(cwd(), ".commands"))) {
      const dir = await readdir(join(cwd(), ".commands"));
      const temp = [] as typeof commands;
      for (const file of dir) {
        if (!file.endsWith(".command.ts")) continue;
        const key = file.slice(0, -11);
        commands.push({ name: file.slice(0, -11), value: key, path: join(cwd(), ".commands", file), description: "workspace" });
      }
      temp.sort((a, b) => a.name.localeCompare(b.name));
      commands.push(...temp);
    }

    if (await exists(join(env.HOME || env.USERPROFILE || "/", ".commands"))) {
      const dir = await readdir(join(env.HOME || env.USERPROFILE || "/", ".commands"));
      const temp = [] as typeof commands;
      for (const file of dir) {
        if (!file.endsWith(".command.ts")) continue;
        const key = file.slice(0, -11);
        commands.push({ name: file.slice(0, -11), value: key, path: join(cwd(), ".commands", file), description: "global" });
      }
      temp.sort((a, b) => a.name.localeCompare(b.name));
      commands.push(...temp);
    }

    if (commands.length === 0) {
      consola.warn("There is no command yet.");
      consola.info("Docs: https://github.com/akirarika/co");
      return;
    }

    const containsCharsInOrder = (input: string, target: string): boolean => {
      let inputIndex = 0;
      for (const char of target) {
        if (char === input[inputIndex]) {
          inputIndex++;
          if (inputIndex === input.length) break;
        }
      }
      return inputIndex === input.length;
    };
    const calculateScore = (input: string, target: string) => {
      let maxContiguous = 0;
      let currentContiguous = 0;
      let firstMatchIndex = -1;

      let inputIndex = 0;
      for (let i = 0; i < target.length; i++) {
        if (target[i] === input[inputIndex]) {
          if (firstMatchIndex === -1) firstMatchIndex = i;
          currentContiguous++;
          inputIndex++;
          maxContiguous = Math.max(maxContiguous, currentContiguous);
        } else {
          currentContiguous = 0;
        }
      }

      return { maxContiguous, firstMatchIndex };
    };
    const selected = await search({
      message: "What kind of command:",
      source: async (input) => {
        if (!input) return commands;
        const filtered = commands.filter((command) => containsCharsInOrder(input.toLowerCase(), command.name.toLowerCase()));

        return uniqWith(filtered, (a, b) => a.value === b.value).sort((a, b) => {
          const scoreA = calculateScore(input, a.name);
          const scoreB = calculateScore(input, b.name);

          if (scoreB.maxContiguous !== scoreA.maxContiguous) {
            return scoreB.maxContiguous - scoreA.maxContiguous;
          }

          return scoreA.firstMatchIndex - scoreB.firstMatchIndex;
        });
      },
    });

    if (!selected || selected === "<cancel>") {
      consola.success("Cookbook cancelled");
      exit(0);
    }
    params.command = selected;
  }

  const built = __router__.find((command) => command.commands.includes(params.command));
  if (built) {
    await run(params, { script: built.script, description: "built-in" });
  } else if (packageJson?.scripts?.[params.command]) {
    run(params, { path: params.command, description: "npm-script" });
  } else if (await exists(join(cwd(), ".commands", `${params.command}.command.ts`))) {
    const modulePath = join(cwd(), ".commands", `${params.command}.command.ts`);
    await run(params, { path: modulePath, description: "workspace" });
  } else if (await exists(join(env.HOME || env.USERPROFILE || "/", ".commands", `${params.command}.command.ts`))) {
    const modulePath = join(env.HOME || env.USERPROFILE || "/", ".commands", `${params.command}.command.ts`);
    await run(params, { path: modulePath, description: "global" });
  } else {
    // not found
    consola.error(`Command not found: ${params.command}`);
    console.log("");
    exit(1);
  }
}

export async function run(params: Params, options: { path?: string; script?: () => Promise<any>; description?: "global" | "npm-script" | "workspace" | "built-in" }) {
  if (options.description === "npm-script") {
    if (!(await exists(join(cwd(), "cookbook.toml")))) await run(params, { path: "init", description: "workspace" });
    const config: any = Bun.TOML.parse(await Bun.file(join(cwd(), "cookbook.toml")).text());
    if (!config.general.packageManager) {
      consola.error('You need to specify which package manager to use to run this command, modify your cookbook.toml file, and [general] bar to packageManager = "npm" or any custom package manager you like.');
      exit(1);
    }

    try {
      if (config.general.packageManager === "bun") {
        execScript(`bun run ${[options.path!, ...params.raw].join(" ")}`, { cwd: cwd() });
      }

      if (config.general.packageManager === "npm") {
        execScript(`npm run ${[options.path!, ...params.raw].join(" ")}`, { cwd: cwd() });
      }

      if (config.general.packageManager === "cnpm") {
        execScript(`cnpm run ${[options.path!, ...params.raw].join(" ")}`, { cwd: cwd() });
      }

      if (config.general.packageManager === "yarn") {
        execScript(`yarn run ${[options.path!, ...params.raw].join(" ")}`, { cwd: cwd() });
      }

      if (config.general.packageManager === "pnpm") {
        execScript(`pnpm run ${[options.path!, ...params.raw].join(" ")}`, { cwd: cwd() });
      }

      exit(0);
    } catch (error: any) {
      consola.error(error?.message ?? "Running Error");
      exit(1);
    }
  }

  if (options.description === "built-in") {
    try {
      const module = await options.script!();
      await module.default(await createCommandUtils(params, options));
      exit(0);
    } catch (error: any) {
      consola.error(error.toString ? error.toString() : (error?.message ?? "Running Error"));
      exit(1);
    }
  }

  try {
    if (!(await exists(options.path))) {
      consola.error(`Command not found: ${options.path}`);
      exit(1);
    }
    const module = await import(options.path!);
    await module.default(await createCommandUtils(params, options));
    exit(0);
  } catch (error: any) {
    consola.error(error.toString ? error.toString() : (error?.message ?? "Running Error"));
    exit(1);
  }
}

async function createCommandUtils(params: Params, options: { path?: string; description?: "global" | "npm-script" | "workspace" | "built-in" }) {
  const log = consola.log;
  const info = consola.info;
  const warn = consola.warn;
  const error = consola.error;
  const success = consola.success;
  const debug = consola.debug;
  const fatal = consola.fatal;
  const trace = consola.trace;
  const start = consola.start;
  const box = consola.box;
  const prompt = consola.prompt;
  const getScriptPath = () => options.path!;
  const getWorkspacePath = () => cwd();
  const getParams = () => params;
  const inputBoolean = async (options: { env: string; message: string; placeholder?: string }) => {
    if (options.env in params.options) return params.options[options.env] === "1";
    return await consola.prompt(options.message, {
      type: "confirm",
      placeholder: options.placeholder,
    });
  };
  const inputString = async (options: { env: string; message: string; placeholder?: string }) => {
    if (options.env in params.options) return params.options[options.env];
    return await consola.prompt(options.message, {
      type: "text",
      placeholder: options.placeholder,
    });
  };

  let cookbookToml: any;

  const canUseAI = async () => {
    if (!cookbookToml) cookbookToml = await getCookbookToml();
    if (!cookbookToml?.config?.aiModel && cookbookToml?.config?.aiBaseUrl && cookbookToml?.config?.aiApiKey) return false;
    return {
      aiBaseUrl: cookbookToml?.config?.aiBaseUrl,
      aiApiKey: cookbookToml?.config?.aiApiKey,
      aiModel: cookbookToml?.config?.aiModel,
    };
  };

  const openProgress = (message: string) => progress.open(message);
  const closeProgress = (message: string) => progress.close(message);

  const utils = {
    log,
    info,
    warn,
    error,
    success,
    debug,
    fatal,
    trace,
    start,
    box,
    prompt,
    getScriptPath,
    getWorkspacePath,
    getParams,
    inputBoolean,
    inputString,
    canUseAI,
    openProgress,
    closeProgress,
    fetchEventSource,
    getCookbookToml: async () => {
      if (cookbookToml) return cookbookToml;
      cookbookToml = await getCookbookToml();
      if (!cookbookToml.config) cookbookToml.config = {};
      return cookbookToml;
    },
    gotoGitCommitCommand: async () => {
      const module = await import("./commands/git-commit");
      return await module.default(utils as any);
    },
    gotoPrismaCommand: async () => {
      const module = await import("./commands/prisma");
      return await module.default(utils as any);
    },
  };

  return utils;
}
