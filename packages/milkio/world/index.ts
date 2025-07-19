import { type $types, __initListener, __initExecuter, __initEventManager, type ExecuteId, type Logger, type Mixin, type GeneratedInit, type Ping, type LoggerSubmittingHandler, type LoggerInsertingHandler } from "../index.ts";
import { defineDefaultExecuteIdGenerator } from "../execute/execute-id-generator.ts";

export interface MilkioInit {
  port: number;
  develop: boolean;
  fetchEnv?: (key: string) => string | undefined;
  accessKey?: string;
  cors?: {
    corsAllowMethods?: string;
    corsAllowHeaders?: string;
    corsAllowOrigin?: string;
  };
  ignorePathLevel?: number;
  realIp?: (headers: Headers) => string;
  executeId?: (headers: Headers) => string | Promise<string>;
  onLoggerSubmitting?: LoggerSubmittingHandler;
  onLoggerInserting?: LoggerInsertingHandler;
  bootstraps?: Array<(world: MilkioWorld) => Promise<void> | void>;
}

export type MilkioRuntimeInit<T extends MilkioInit> = Mixin<
  T,
  {
    executeId: (headers: Headers) => string | Promise<string>;
    runtime: {
      request: Map<ExecuteId, { logger: Logger }>;
      config: Awaited<ReturnType<$types["generated"]["configSchema"]>>;
      app: any;
    };
    on: Awaited<ReturnType<typeof __initEventManager>>["on"];
    off: Awaited<ReturnType<typeof __initEventManager>>["off"];
    emit: Awaited<ReturnType<typeof __initEventManager>>["emit"];
  }
>;

export async function createWorld<MilkioOptions extends MilkioInit>(generated: GeneratedInit, configSchema: { get: () => Promise<Record<any, any>> }, options: MilkioOptions): Promise<MilkioWorld<MilkioOptions>> {
  const executeId = options.executeId ?? defineDefaultExecuteIdGenerator();
  const config = await configSchema.get();

  const runtime = {
    request: new Map(),
    config,
  } as MilkioRuntimeInit<MilkioOptions>["runtime"];

  const eventManager = __initEventManager();

  if (options.accessKey) options.ignorePathLevel = options.ignorePathLevel ? options.ignorePathLevel + 1 : 1;

  const _: MilkioRuntimeInit<MilkioOptions> = {
    ...options,
    executeId,
    runtime,
    on: eventManager.on,
    off: eventManager.off,
    emit: eventManager.emit,
  };

  const executer = __initExecuter(generated, _);
  const listener = __initListener(generated, _, executer);

  // Initialize the app
  const world = {
    _,
    // event manager
    on: eventManager.on,
    off: eventManager.off,
    emit: eventManager.emit,
    // listener
    listener,
    // function
    config,
  };

  runtime.app = world;

  if (Array.isArray(options.bootstraps)) {
    for (const bootstrap of options.bootstraps) {
      await bootstrap(world as MilkioWorld<MilkioOptions>);
    }
  }

  await Promise.all(generated.handlerSchema.loadHandlers(world));

  console.log(`△ Routes:\n    ${Object.keys(generated.routeSchema as Record<string, any>).join("\n    ")}`);
  console.log(`△ Server: http://localhost:${options.port}`);

  return world as MilkioWorld<MilkioOptions>;
}

export interface MilkioWorld<MilkioOptions extends MilkioInit = MilkioInit> {
  _: MilkioRuntimeInit<MilkioOptions>;
  // event manager
  on: Awaited<ReturnType<typeof __initEventManager>>["on"];
  off: Awaited<ReturnType<typeof __initEventManager>>["off"];
  emit: Awaited<ReturnType<typeof __initEventManager>>["emit"];
  ping: (options?: { timeout?: number }) => Promise<Ping>;
  // listener
  listener: Awaited<ReturnType<typeof __initListener>>;
  config: Readonly<Awaited<ReturnType<$types["configSchema"]["get"]>>>;
}
