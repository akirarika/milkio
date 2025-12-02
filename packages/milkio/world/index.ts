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
    bootstraps?: Array<(world: any) => Promise<void> | void>;
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
        emitAnyApproved: Awaited<ReturnType<typeof __initEventManager>>["emitAnyApproved"];
        emitAllApproved: Awaited<ReturnType<typeof __initEventManager>>["emitAllApproved"];
    }
>;

export async function createWorld<MilkioOptions extends MilkioInit>(generated: GeneratedInit, configSchema: { get: () => Promise<Record<any, any>> }, options: MilkioOptions): Promise<unknown> {
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
        emitAnyApproved: eventManager.emitAnyApproved,
        emitAllApproved: eventManager.emitAllApproved,
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
        emitAnyApproved: eventManager.emitAnyApproved,
        emitAllApproved: eventManager.emitAllApproved,
        // listener
        listener,
        // function
        config,
    };

    runtime.app = world;

    if (Array.isArray(options.bootstraps)) {
        for (const bootstrap of options.bootstraps) {
            await bootstrap(world as MilkioWorld<GeneratedInit, MilkioOptions>);
        }
    }

    await Promise.all(generated.handlerSchema.loadHandlers(world));

    const routeKeys = Object.keys(generated.routeSchema as Record<string, any>);
    console.log(`\n△ Routes:\n    ${routeKeys.join("\n    ")}\n  A total of ${routeKeys.length} routes.`);
    console.log(`\n△ Server: http://localhost:${options.port}`);

    return world as unknown;
}

export interface MilkioWorld<Generated extends GeneratedInit, MilkioOptions extends MilkioInit = MilkioInit> {
    _: MilkioRuntimeInit<MilkioOptions>;
    // event manager
    on: <Key extends keyof Generated["events"], Handler extends (event: Generated["events"][Key]) => void>(key: Key, handler: Handler) => (() => void);
    off: <Key extends keyof Generated["events"], Handler extends (event: Generated["events"][Key]) => void>(key: Key, handler: Handler) => void;
    emit: <Key extends keyof Generated["events"], Value extends Generated["events"][Key]>(key: Key, value: Value) => Promise<void>;
    emitAnyApproved: <Key extends keyof Generated["events"], Value extends Generated["events"][Key]>(key: Key, value: Value) => Promise<boolean>;
    emitAllApproved: <Key extends keyof Generated["events"], Value extends Generated["events"][Key]>(key: Key, value: Value) => Promise<boolean>;
    ping: (options?: { timeout?: number }) => Promise<Ping>;
    // listener
    listener: Awaited<ReturnType<typeof __initListener>>;
    config: Readonly<Awaited<ReturnType<$types["configSchema"]["get"]>>>;
}
