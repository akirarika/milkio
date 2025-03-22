import type { GeneratedInit } from "../index.ts";

export function command<CommandInitT extends CommandInit>(init: CommandInitT): Command<CommandInitT> {
  const command = init as unknown as Command<CommandInitT>;
  command.$milkioType = "command";
  return command;
}

export interface CommandInit {
  handler: (commands: Array<string>, options: Record<string, string>) => Promise<unknown>;
}

export interface Command<CommandInitT extends CommandInit> {
  $milkioType: "command";
  handler: CommandInitT["handler"];
}

export function __initCommander(generated: GeneratedInit, runtime: any) {
  const commander = async (argv: Array<string>, options?: { onNotFound?: () => any }) => {
    const params = {
      path: "index",
      commands: [] as Array<string>,
      options: {} as Record<string, string | true>,
    };
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
    if (argv.length === 2) params.path = "index";
    else params.path = `${argv[2] ?? "index"}`;

    if (!(params.path in generated.commandSchema.commands)) {
      if (options?.onNotFound) return await options.onNotFound();
      console.log(`\x1B[44m UwU \x1B[0m \x1B[2mCommand not found:\x1B[0m \x1B[32m${params.path}\x1B[0m`);
      return undefined;
    }

    return await generated.commandSchema.commands[params.path].module.handler(params.commands, params.options);
  };

  return commander;
}
