import { __initCommander, __initListener, ExecuteId, type Logger, type Mixin, type GeneratedInit, $types, Execute } from "..";
import { __initExecuter } from "../execute";
import { defineDefaultExecuteIdGenerator } from "../execute/execute-id-generator";

export type MilkioInit = {
  port: {
    app: number;
    develop: number | "disabled";
  };
  getRealIp?: (request: Request) => string;
  executeIdGenerator?: (request: Request) => string | Promise<string>;
  ignorePathLevel?: number;
};

export type MilkioRuntimeInit<T extends MilkioInit> = Mixin<
  T,
  {
    executeIdGenerator: (request: Request) => string | Promise<string>;
    runtime: {
      request: Map<ExecuteId, { logger: Logger }>;
    };
  }
>;

export const defineMilkioWorld = async <CookbookOptions extends MilkioInit>(generated: GeneratedInit, options: CookbookOptions): Promise<MilkioWorld<CookbookOptions>> => {
  const executeIdGenerator = options.executeIdGenerator ?? defineDefaultExecuteIdGenerator();

  const runtime = {
    request: new Map(),
  } as MilkioRuntimeInit<CookbookOptions>["runtime"];

  const _: MilkioRuntimeInit<CookbookOptions> = {
    ...options,
    executeIdGenerator,
    runtime,
  };

  const executer = __initExecuter(generated, _);
  const commander = __initCommander(generated, _);
  const listener = __initListener(generated, _, executer);

  // Initialize the app
  const app = {
    _: _,
    _executer: executer,
    execute: executer.execute,
    commander,
    listener,
  };

  return app as MilkioWorld<CookbookOptions>;
};

export type MilkioWorld<CookbookOptions extends MilkioInit = MilkioInit> = {
  _: MilkioRuntimeInit<CookbookOptions>;
  _executer: Awaited<ReturnType<typeof __initExecuter<MilkioRuntimeInit<CookbookOptions>>>>;
  commander: Awaited<ReturnType<typeof __initCommander<MilkioRuntimeInit<CookbookOptions>>>>;
  listener: Awaited<ReturnType<typeof __initListener<MilkioRuntimeInit<CookbookOptions>>>>;
  execute: Execute;
};
