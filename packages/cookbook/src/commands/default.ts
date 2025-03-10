import { search } from "@inquirer/prompts";
import { argv, cwd, exit } from "node:process";
import consola from "consola";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { exists, mkdir } from "node:fs/promises";
import { initCommand } from "./init";
import { readdir, readFile } from "node:fs/promises";
import { env } from "bun";
import { __router__, paths } from "./__router__";

type Params = {
  command: string;
  commands: Array<string>;
  options: Record<string, string | true>;
  raw: Array<string>;
};

export async function defaultCommand() {
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

  if (params.command === "index") {
    const commands = [] as Array<{ name: string; value: string; path?: string; description?: "global" | "npm-script" | "workspace" | "built-in" }>;

    for (const path of paths) {
      commands.push({ name: path, value: path, description: "built-in" });
    }
  
    if (await exists(join(env.HOME || env.USERPROFILE || "/", ".commands"))) {
      const dir = await readdir(join(env.HOME || env.USERPROFILE || "/", ".commands"));
      let temp = [] as typeof commands;
      for (const file of dir) {
        if (!file.endsWith(".ts")) continue;
        temp.push({ name: file.slice(0, -3), value: file, path: join(env.HOME || env.USERPROFILE || "/", ".commands", file), description: "global" });
      }
      temp.sort((a, b) => a.name.localeCompare(b.name));
      commands.push(...temp);
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
        if (!file.endsWith(".ts")) continue;
        commands.push({ name: file.slice(0, -3), value: file, path: join(cwd(), ".commands", file), description: "workspace" });
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
      source: async (input, { signal }) => {
        return commands.filter((command) => {
          return command.name.startsWith(input ?? "");
        });
      },
    });

    const command = commands.find((v) => v.value === selected)!
    if (command.description === 'built-in') await __router__(command.value!);
    else await run(params, command as any);
    exit(0);
  } else if (await exists(join(cwd(), ".commands", `${params.command}.ts`))) {
    const modulePath = join(cwd(), ".commands", `${params.command}.ts`);
    await run(params, { path: modulePath, description: "workspace" });
  } else if (packageJson?.scripts?.[params.command]) {
    run(params, { path: params.command, description: "npm-script" });
  } else if (await exists(join(env.HOME || env.USERPROFILE || "/", ".commands", `${params.command}.ts`))) {
    const modulePath = join(env.HOME || env.USERPROFILE || "/", ".commands", `${params.command}.ts`);
    await run(params, { path: modulePath, description: "global" });
  } else {
    // not found
    consola.error(`Command not found: ${params.command}`);
    console.log("");
    exit(1);
  }
}

export async function run(params: Params, options: { path?: string; description?: "global" | "npm-script" | "workspace" }) {
  if (options.description === "npm-script") {
    if (!(await exists(join(cwd(), "cookbook.toml")))) await initCommand();
    const config: any = Bun.TOML.parse(await Bun.file(join(cwd(), "cookbook.toml")).text());

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
  } else {
    try {
      execFileSync("bun", ["run", options.path!, JSON.stringify(params)], { stdio: "inherit", shell: true, env: { TERM: "xterm-256color", ...process.env } });
      exit(0);
    } catch (error: any) {
      consola.error(error?.message ?? "Running Error");
      exit(1);
    }
  }
}