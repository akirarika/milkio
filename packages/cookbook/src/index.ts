import { search } from "@inquirer/prompts";
import { argv, cwd, exit } from "node:process";
import consola from "consola";
import { join } from "node:path";
import { exists } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { __router__ } from "./commands/__router__";
import { uniqWith } from "lodash-es";
import { execScriptOrFail } from "./utils/exec-script";
import { createCommandUtils } from "./commands/__utils__";
import { handleNonCookbookPkgMgr } from "./utils/handle-non-cookbook-pkg-mgr";
import { createPromptAbortController, handlePromptAbort } from "./utils/prompt-timeout";
import { ensureNodeModulesExportsPatched } from "./utils/patch-node-modules-exports.ts";

export type Params = {
  command: string;
  commands: Array<string>;
  options: Record<string, string | true>;
  raw: Array<string>;
  subCommand?: string; // 新增子命令字段
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

  // 处理冒号分隔的子命令
  if (params.command.includes(":")) {
    const parts = params.command.split(":");
    params.command = parts[0];
    params.subCommand = parts.slice(1).join(":");
  }

  if (params.command.startsWith("--")) params.command = params.command.slice(2);
  if (params.command.startsWith("-") && params.command !== "-") params.command = params.command.slice(1);

  // --help / -h / help / h: show top-level help
  if (params.command === "help" || params.command === "h" || params.options.help === "1" || params.options.h === "1") {
    if (params.command !== "help" && params.command !== "h" && params.command !== "index") {
      const cmd = __router__.find((c) => c.commands.includes(params.command));
      if (cmd) {
        console.log(`co ${params.command}`);
        console.log("");
        console.log(`Aliases: ${cmd.commands.join(", ")}`);
        console.log("");
        console.log("Run without --help to execute this command.");
        exit(0);
      }
    }
    console.log("cookbook - project orchestration CLI");
    console.log("");
    console.log("Usage:");
    console.log("  co                       Interactive command selector");
    console.log("  co <command> [options]   Run a built-in command");
    console.log("  co <npm-script>          Run an npm script from package.json");
    console.log("");
    console.log("Built-in commands:");
    const visible = __router__.filter((c) => c.hidden !== true);
    const nameWidth = Math.max(...visible.map((c) => c.commands[0].length));
    for (const c of visible) {
      console.log(`  ${c.commands[0].padEnd(nameWidth)}   (aliases: ${c.commands.join(", ")})`);
    }
    console.log("");
    console.log("Hidden commands (still callable):");
    const hidden = __router__.filter((c) => c.hidden === true);
    const hiddenWidth = Math.max(...hidden.map((c) => c.commands[0].length));
    for (const c of hidden) {
      console.log(`  ${c.commands[0].padEnd(hiddenWidth)}   (aliases: ${c.commands.join(", ")})`);
    }
    console.log("");
    console.log("Docs: https://github.com/akirarika/co");
    exit(0);
  }

  const packageJson = (await exists(join(cwd(), "package.json"))) ? JSON.parse(await readFile(join(cwd(), "package.json"), "utf-8")) : undefined;

  if (params.command === "index") {
    const commands = [
      {
        name: "<cancel>",
        value: "<cancel>",
        description: "built-in",
      },
    ] as Array<{ name: string; value: string; path?: string; description?: "npm-script" | "built-in" }>;

    for (const command of __router__) {
      if (command.hidden !== true) commands.push({ name: command.commands[0], value: command.commands[0], description: "built-in" });
    }

    if (await exists(join(cwd(), "package.json"))) {
      const packageJson = JSON.parse(await readFile(join(cwd(), "package.json"), "utf-8"));
      for (const key in packageJson?.scripts ?? {}) {
        commands.push({ name: key, value: key, path: key, description: "npm-script" });
      }
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
    const selected = await (async () => {
      const { controller, timeoutId } = createPromptAbortController();
      try {
        return await search(
          {
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
          },
          { signal: controller.signal },
        );
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (controller.signal.aborted) {
          handlePromptAbort(
            err,
            "select command",
            'To run non-interactively, directly invoke the subcommand, e.g. "co dev", "co test", "co build".',
          );
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    })();

    if (!selected || selected === "<cancel>") {
      consola.success("Cookbook cancelled");
      exit(0);
    }
    params.command = selected;
  }

  const built = __router__.find((command) => command.commands.includes(params.command));

  // 在会启动/构建项目的命令执行前，无条件修正 node_modules 中上游包有缺陷的
  // exports（typia、estree-walker），保证任何代码路径解析到的都是已修复状态
  const EXPORT_PATCH_COMMANDS = new Set(["dev", "start", "test", "build", "generate", "install", "i", "add", "upgrade"]);
  if (built && EXPORT_PATCH_COMMANDS.has(params.command)) {
    await ensureNodeModulesExportsPatched(cwd());
  }

  if (built) {
    if (params.command === "dev") {
      const pkgMgr = await handleNonCookbookPkgMgr();
      if (!pkgMgr) await run(params, { script: built.script, description: "built-in" });
      else await run(params, { path: params.command, description: "npm-script", pkgMgr });
    } else {
      await run(params, { script: built.script, description: "built-in" });
    }
  } else {
    const pkgMgr = await handleNonCookbookPkgMgr();
    if (pkgMgr) {
      await run(params, { path: params.command, description: "npm-script", pkgMgr });
    } else if (packageJson?.scripts?.[params.command]) {
      await run(params, { path: params.command, description: "npm-script" });
    } else {
      // not found
      consola.error(`Command not found: ${params.command}`);
      consola.info(`Hint: run "co --help" to see the list of available commands.`);
      exit(1);
    }
  }
}

export async function run(params: Params, options: { path?: string; script?: () => Promise<any>; description?: "npm-script" | "built-in"; pkgMgr?: string }) {
  let packageManager: any;
  if (options.description === "npm-script") {
    if (!options.pkgMgr) {
      const config: any = Bun.TOML.parse(await Bun.file(join(cwd(), "cookbook.toml")).text());
      if (!config.general.packageManager) {
        consola.error('You need to specify which package manager to use to run this command, modify your cookbook.toml file, and [general] bar to packageManager = "npm" or any custom package manager you like.');
        exit(1);
      }
      packageManager = config.general.packageManager;
    } else {
      packageManager = options.pkgMgr;
    }

    try {
      if (packageManager === "bun") {
        await execScriptOrFail(`bun run ${[options.path!, ...params.raw].join(" ")}`, { cwd: cwd() });
      } else if (packageManager === "npm") {
        await execScriptOrFail(`npm run ${[options.path!, ...params.raw].join(" ")}`, { cwd: cwd() });
      } else if (packageManager === "cnpm") {
        await execScriptOrFail(`cnpm run ${[options.path!, ...params.raw].join(" ")}`, { cwd: cwd() });
      } else if (packageManager === "yarn") {
        await execScriptOrFail(`yarn run ${[options.path!, ...params.raw].join(" ")}`, { cwd: cwd() });
      } else if (packageManager === "pnpm") {
        await execScriptOrFail(`pnpm run ${[options.path!, ...params.raw].join(" ")}`, { cwd: cwd() });
      } else {
        consola.error(`Package manager ${packageManager} is not supported`);
        exit(1);
      }
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
}
