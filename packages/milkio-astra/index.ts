import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { cwd } from "node:process";
import { load } from "js-toml";
import { format } from "date-fns";
import type { CookbookOptions } from "./utils/cookbook-dto-types.ts";

async function findCookbookBaseUrl(): Promise<string> {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    let searchDir = currentDir;

    while (searchDir !== dirname(searchDir)) {
        const cookbookPath = join(searchDir, ".cookbook");
        if (existsSync(cookbookPath)) {
            const content = await readFile(cookbookPath, "utf-8");
            return content.trim();
        }
        searchDir = dirname(searchDir);
    }

    throw new Error("[cookbook] Could not find \".cookbook\" file in any parent directory");
}

export type AstraOptionsInit = {
    stargate: { $types: any; execute: any; ping: any; __cookbook: any };
    bootstrap: () => Promise<Record<string, any>>;
};

type GeneratorGeneric<T> = T extends AsyncGenerator<infer I> ? I : never;

type Mixin<T, U> = U & Omit<T, keyof U>;

type ExecuteOptions = {
    headers?: Record<string, string>;
    timeout?: number;
    type?: "action" | "stream";
};

type ExecuteResultsOption = { executeId: string };

type Context = {
    logger: Logger;
};

type Logger = {
    debug: (description: string, ...params: Array<unknown>) => Log;
    info: (description: string, ...params: Array<unknown>) => Log;
    warn: (description: string, ...params: Array<unknown>) => Log;
    error: (description: string, ...params: Array<unknown>) => Log;
    response: (description: string, ...params: Array<unknown>) => Log;
};

// type Log = [string /* executeId */, "[DEBUG]" | "[INFO]" | "[WARN]" | "[ERROR]" | "[RESPONSE]", string, string, ...Array<unknown>];
type Log = [string, "(debug)" | "(info)" | "(warn)" | "(error)" | "(response)", string, string, ...Array<unknown>];

type Reject = (description: string, ...params: Array<unknown>) => Error;

type DeepPartial<T> = T extends Function ? T : T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

export async function createAstra<AstraOptions extends AstraOptionsInit, Generated extends AstraOptions["stargate"]["$types"]["generated"]>(astraOptions: AstraOptions) {
    if (!existsSync(join(cwd(), "cookbook.toml"))) throw new Error(`The "cookbook.toml" file does not exist in the current directory. If you are running the test with the VS Code extension, make sure it exists in the root directory of the folder you are opening with VS Code.`);
    const cookbookOptions = load((await readFile(join(cwd(), "cookbook.toml"))).toString()) as CookbookOptions;
    // wait for all milkio projects to start and can be accessed
    // the reason why stargate's ping method is not used directly is that even if only one project is tested, it is necessary to wait for all milkio projects to start

    console.log("・[astra]", "connecting..");
    await Promise.all((() => {
        const projectStatus = new Map<string, { promise: Promise<undefined>; resolve: (value?: undefined | PromiseLike<undefined>) => void; reject: (reason?: any) => void }>();
        for (const projectName in cookbookOptions.projects) {
            const project = cookbookOptions.projects[projectName];
            if (project.type !== "milkio") continue;
            if (projectName === "cookbook-server" && project.port === 52593) continue; // the cookbook-server is not a milkio project
            projectStatus.set(projectName, withResolvers());
            let error: any;
            let counter = 16;
            const handler = async () => {
                try {
                    const cookbookBaseUrl = await findCookbookBaseUrl();
                    const response = await fetchWithTimeout(`${cookbookBaseUrl}/mode/read`, { method: "HEAD", timeout: 1024 });
                    const data = JSON.parse(await response.text());
                    if (data?.data?.mode !== "test") {
                        const message = `[cookbook] The cookbook must run in test mode (mode === "test") to execute tests. This restriction is in place to prevent accidental operations. Please restart the cookbook and select the test mode.`;
                        console.error(message);
                        throw new Error(message);
                    }
                } catch (error) {
                    const message = `[cookbook] It seems that Cookbook has not started, and Astra cannot communicate with Cookbook successfully. Please try to start/restart Cookbook.`
                    console.error(message);
                    throw new Error(message);
                }
                if (--counter <= 0) {
                    clearInterval(timer!);
                    timer = null;
                    console.error(error);
                    console.warn(`[cookbook] Your project ${projectName} (http://localhost:${project.port}/) HTTP server hasn't started for too long.`);
                    projectStatus.get(projectName)!.resolve(undefined);
                    return;
                }
                try {
                    const response = await fetchWithTimeout(`http://localhost:${project.port}/generate_204`, { method: "HEAD", timeout: 1024 });
                    const status = Number(response.status);
                    if (status === 204 && response.headers.get("Server") === "milkio") {
                        clearInterval(timer!);
                        timer = null;
                        return projectStatus.get(projectName)!.resolve(undefined);
                    }
                    const message = `[cookbook] Your project ${projectName} (http://localhost:${project.port}/) doesn't seem to be a Milkio project, because it didn't respond to milkio-astra correctly. It returned the status code ${status} instead of 204. However, this project has specified type = "milkio" for it in cookbook.toml. If this is incorrect, please fix it and replace it with type = "custom".`;
                    console.error(message);
                    throw new Error(message);
                } catch (e) {
                    error = e;
                }
            };
            let timer: Timer | null = setInterval(handler, 1024);
            handler();
        }
        return Array.from(projectStatus.values()).map((v) => v.promise);
    })());

    type Execute = <Path extends keyof Generated["routeSchema"]>(
        path: Path,
        options?: Mixin<
            ExecuteOptions,
            | {
                params?: Generated["routeSchema"][Path]["types"]["params"];
            }
            | {
                params?: DeepPartial<Generated["routeSchema"][Path]["types"]["params"]>;
                generateParams: true;
            }
        >,
    ) => Promise<
        Generated["routeSchema"][Path]["types"]["🥛"] extends boolean
        ? // action
        [Partial<Generated["rejectCode"]>, null, ExecuteResultsOption] | [null, Generated["routeSchema"][Path]["types"]["result"], ExecuteResultsOption]
        : // stream
        [Partial<Generated["rejectCode"]>, null, ExecuteResultsOption] | [null, AsyncGenerator<[Partial<Generated["rejectCode"]>, null] | [null, GeneratorGeneric<Generated["routeSchema"][Path]["types"]["result"]>], ExecuteResultsOption>]
    >;

    type MirrorWorld = Mixin<
        Awaited<ReturnType<AstraOptions["bootstrap"]>>,
        {
            paths: { cwd: string; milkio: string; generated: string };
            execute: Execute;
        }
    >;

    return {
        options: astraOptions,
        async createMirrorWorld(importMetaUrl: string): Promise<[Context, Reject, MirrorWorld]> {
            const thisFilePath = join(fileURLToPath(importMetaUrl));
            const thisFileDirPath = join(dirname(thisFilePath)).replaceAll("\\", "/");
            const thisFileDirPathArr = thisFileDirPath.split("/");
            let projectName = "";

            await (async () => {
                let isProjectsDirectory = false;
                for (let i = 0; i < thisFileDirPathArr.length; i++) {
                    if (thisFileDirPathArr[i] === "projects") {
                        isProjectsDirectory = true;
                        continue;
                    }
                    if (isProjectsDirectory === false) continue;
                    projectName = thisFileDirPathArr[i];
                    break;
                }
                if (projectName === "") throw new Error("Unable to determine the path of the current test, make sure the test is under a milkio project.");
                let projectNameChecked = false;
                for (const projectNameForCookbookOptions in cookbookOptions.projects) {
                    if (projectNameForCookbookOptions === projectName) {
                        projectNameChecked = true;
                        break;
                    }
                }
                if (projectNameChecked === false) throw new Error(`Project name "${projectName}" not found in "cookbook.toml" in "projects.${projectName}".`);
            })();

            const paths = {
                cwd: join(cwd(), "projects", projectName),
                milkio: join(cwd(), "projects", projectName, ".milkio"),
                generated: join(cwd(), "projects", projectName, ".milkio"),
            };

            const execute = async (path: Parameters<MirrorWorld["execute"]>[0], optionsInit?: Parameters<MirrorWorld["execute"]>[1]) => {
                const options = (optionsInit as any) ?? {};
                if (options?.generateParams === true) {
                    if (!options?.params) options.params = {};
                    options.params.$milkioGenerateParams = "enable";
                }

                const results = await this.options.stargate.__cookbook.subscribe(`http://localhost:${cookbookOptions.general.cookbookPort}`);
                void (async () => {
                    for await (const result of results) {
                        if (result.type !== "milkio@logger") continue;
                        console.log("\n・[milkio]", ...(result.log ?? []));
                    }
                })();

                const response = await this.options.stargate.execute(path, options);

                await new Promise((resolve) => setTimeout(resolve, 40));
                context.logger.response(path as string, `\n・> (error) - ${JSON.stringify(response[0])}`, `\n・> (response) - ${typeof response[1]?.next === "function" ? "AsyncGenerator" : JSON.stringify(response[1])}`);

                return response;
            };

            const getNow = () => format(new Date(), "(yyyy-MM-dd hh:mm:ss)");
            const onLoggerInserting = (log: Log) => {
                log = [...log];
                log[0] = `\n${log[0]}` as any;
                console.log(...log);
                return true;
            };

            const context = {
                logger: {
                    debug: (description: string, ...params: Array<unknown>): Log => {
                        const log: Log = ["・[astra]", "(debug)", description, getNow(), ...params];
                        onLoggerInserting(log);
                        return log;
                    },
                    info: (description: string, ...params: Array<unknown>): Log => {
                        const log: Log = ["・[astra]", "(info)", description, getNow(), ...params];
                        onLoggerInserting(log);
                        return log;
                    },
                    warn: (description: string, ...params: Array<unknown>): Log => {
                        const log: Log = ["・[astra]", "(warn)", description, getNow(), ...params];
                        onLoggerInserting(log);
                        return log;
                    },
                    error: (description: string, ...params: Array<unknown>): Log => {
                        const log: Log = ["・[astra]", "(error)", description, getNow(), ...params];
                        onLoggerInserting(log);
                        return log;
                    },
                    response: (path: string, ...params: Array<unknown>): Log => {
                        const log: Log = ["・[astra]", "(response)", path, getNow(), ...params];
                        onLoggerInserting(log);
                        return log;
                    },
                },
            } as Context;

            const world = {
                ...(await astraOptions.bootstrap()),
                paths,
                execute,
            } as any;

            const reject = (...params: Array<unknown>): Error => {
                const output: Array<any> = [
                    "[astra]",
                    "(reject)",
                    ...params.map((param) => {
                        if (typeof param !== "object") return param;
                        try {
                            return `${JSON.stringify(param)}\n${param}`;
                        } catch (_) {
                            return param;
                        }
                    }),
                ];
                console.log(...output);
                for (let index = 1; index < output.length; index++) {
                    if (typeof output[index] === "object") {
                        output[index] = output[index].toString();
                    }
                }
                const message = output.join(" ");
                return new Error(message);
            };

            return [context, reject, world];
        },
    };
}

export async function fetchWithTimeout(url: string, options: FetchRequestInit & { timeout?: number } = {}) {
    const { timeout = 8000 } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, {
        ...options,
        signal: controller.signal,
    });
    clearTimeout(id);
    return response;
}

function withResolvers<T = any>(): PromiseWithResolvers<T> {
    let resolve: PromiseWithResolvers<T>["resolve"];
    let reject: PromiseWithResolvers<T>["reject"];
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
}
