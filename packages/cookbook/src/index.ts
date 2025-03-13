import { search } from "@inquirer/prompts";
import { argv, cwd, exit } from "node:process";
import consola from "consola";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { exists, mkdir, writeFile } from "node:fs/promises";
import { readdir, readFile } from "node:fs/promises";
import { env } from "bun";
import { getCookbookToml } from "./utils/get-cookbook-toml";
import { __router__ } from "./commands/__router__";
import { uniqBy, uniqWith } from "lodash-es";
import type OpenAI from "openai";
import { progress } from "./progress";

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
  if (argv.length === 2) params.command = `index`;
  if (argv.length !== 2) params.command = `${argv[2] ?? "index"}`;
  if (params.command.startsWith("--")) params.command = params.command.slice(2);
  if (params.command.startsWith("-") && params.command !== "-") params.command = params.command.slice(1);


  const packageJson = (await exists(join(cwd(), "package.json"))) ? JSON.parse(await readFile(join(cwd(), "package.json"), "utf-8")) : undefined;
  exists(join(env.HOME || env.USERPROFILE || "/", ".commands"));
  if (!(await exists(join(env.HOME || env.USERPROFILE || "/", ".commands")))) await mkdir(join(env.HOME || env.USERPROFILE || "/", ".commands"));
  if (!(await exists(join(env.HOME || env.USERPROFILE || "/", ".commands", "package.json")))) await writeFile(join(env.HOME || env.USERPROFILE || "/", ".commands", "package.json"), JSON.stringify({ name: "commands", private: true, scripts: {}, dependencies: { '@milkio/cookbook-command': '*' }, devDependencies: {} }, null, 2));

  if (params.command === "index") {
    let commands = [] as Array<{ name: string; value: string; path?: string; description?: "global" | "npm-script" | "workspace" | "built-in" }>;

    for (const command of __router__) {
      commands.push({ name: command.commands[0], value: command.commands[0], description: "built-in" });
    }

    if (await exists(join(cwd(), "package.json"))) {
      const packageJson = JSON.parse(await readFile(join(cwd(), "package.json"), "utf-8"));
      for (const key in packageJson?.scripts ?? {}) {
        commands.push({ name: key, value: key, path: key, description: "npm-script" });
      }
    }

    if (await exists(join(cwd(), ".commands"))) {
      const dir = await readdir(join(cwd(), ".commands"));
      let temp = [] as typeof commands;
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
      let temp = [] as typeof commands;
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
      consola.info(`Docs: https://github.com/akirarika/co`);
      return;
    }

    const selected = await search({
      message: "Which command to execute?",
      source: async (input) => {
        return uniqWith(commands, (a, b) => (a.value === b.value)).filter((command) => {
          return command.name.startsWith(input ?? "");
        });
      },
    });

    if (!selected) exit(0);
    params.command = selected;
  }

  const built = __router__.find((command) => command.commands.includes(params.command))
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

export async function run(params: Params, options: { path?: string; script?: () => Promise<any>, description?: "global" | "npm-script" | "workspace" | "built-in" }) {
  if (options.description === "npm-script") {
    if (!(await exists(join(cwd(), "cookbook.toml")))) await run(params, { path: "init", description: "workspace" });
    const config: any = Bun.TOML.parse(await Bun.file(join(cwd(), "cookbook.toml")).text());
    if (!config.general.packageManager) {
      consola.error("You need to specify which package manager to use to run this command, modify your cookbook.toml file, and [general] bar to packageManager = \"npm\" or any custom package manager you like.");
      exit(1);
    }

    try {
      if (config.general.packageManager === "bun") {
        execFileSync("bun", ["run", options.path!, ...params.raw], { stdio: "inherit", shell: true, env: { TERM: "xterm-256color", ...process.env } });
      }

      if (config.general.packageManager === "npm") {
        execFileSync("npm", ["run", options.path!, ...params.raw], { stdio: "inherit", shell: true, env: { TERM: "xterm-256color", ...process.env } });
      }

      if (config.general.packageManager === "cnpm") {
        execFileSync("cnpm", ["run", options.path!, ...params.raw], { stdio: "inherit", shell: true, env: { TERM: "xterm-256color", ...process.env } });
      }

      if (config.general.packageManager === "yarn") {
        execFileSync("yarn", ["run", options.path!, ...params.raw], { stdio: "inherit", shell: true, env: { TERM: "xterm-256color", ...process.env } });
      }

      if (config.general.packageManager === "pnpm") {
        execFileSync("pnpm", ["run", options.path!, ...params.raw], { stdio: "inherit", shell: true, env: { TERM: "xterm-256color", ...process.env } });
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
      consola.error(error.toString ? (error.toString()) : (error?.message ?? "Running Error"));
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
    consola.error(error.toString ? (error.toString()) : (error?.message ?? "Running Error"));
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
  const inputBoolean = async (options: { env: string, message: string, placeholder?: string }) => {
    if (options.env in params.options) return params.options[options.env] === "1";
    return await consola.prompt(options.message, {
      type: "confirm",
      placeholder: options.placeholder,
    })
  };
  const inputString = async (options: { env: string, message: string, placeholder?: string }) => {
    if (options.env in params.options) return params.options[options.env];
    return await consola.prompt(options.message, {
      type: "text",
      placeholder: options.placeholder,
    })
  };

  let cookbookToml: any;

  let ai: OpenAI;
  const useAI = async () => {
    if (!cookbookToml) cookbookToml = await getCookbookToml();
    if (!ai) {
      const OpenAI = await import('openai');
      ai = new OpenAI.default({
        baseURL: cookbookToml.config.aiBaseUrl,
        apiKey: cookbookToml.config.aiApiKey,
      });
    }
    if (!cookbookToml.config || !cookbookToml.config.aiModel) {
      consola.error(`AI model not configured. Please add 'aiModel = "Your-Model-Name"' under [config] section in cookbook.toml`);
      exit(1);
    }
    if (!cookbookToml.config.aiBaseUrl) {
      consola.error(`AI base url not configured. Please add 'aiBaseUrl = "https://api.example.com/chat"' under [config] section in cookbook.toml`);
      exit(1);
    }
    if (!cookbookToml.config.aiApiKey) {
      consola.error(`AI api key not configured. Please add 'aiApiKey = "xxxx-xxxx-xxxx-xxxx' under [config] section in cookbook.toml`);
      exit(1);
    }
    return { client: ai, model: cookbookToml.config.aiModel };
  }
  const canUseAI = async () => {
    if (!cookbookToml) cookbookToml = await getCookbookToml();
    return cookbookToml?.config?.aiModel && cookbookToml?.config?.aiBaseUrl && cookbookToml?.config?.aiApiKey;
  }

  const openProgress = (message: string) => progress.open(message)
  const closeProgress =  (message: string) => progress.close(message)

  return {
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
    useAI,
    openProgress,
    closeProgress,
    getCookbookToml: async () => {
      if (cookbookToml) return cookbookToml;
      cookbookToml = await getCookbookToml();
      if (!cookbookToml.config) cookbookToml.config = {}
      return cookbookToml;
    }
  }
}