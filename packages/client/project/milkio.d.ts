/// <reference types="node" />
/// <reference types="bun-types" />
export declare const milkio: Promise<{
    execute: <Path extends "cookbook" | "a-sandbox/sandbox" | "$/default" | "$/say" | "hello-world/say", Result extends Awaited<ReturnType<{
        cookbook: typeof import("./src/apps/cookbook");
        'a-sandbox/sandbox': typeof import("./src/apps/a-sandbox/sandbox");
        '$/default': typeof import("./src/apps/$/default");
        '$/say': typeof import("./src/apps/$/say");
        'hello-world/say': typeof import("./src/apps/hello-world/say");
    }[Path]["api"]["action"]>>>(path: Path, params: string | Parameters<{
        cookbook: typeof import("./src/apps/cookbook");
        'a-sandbox/sandbox': typeof import("./src/apps/a-sandbox/sandbox");
        '$/default': typeof import("./src/apps/$/default");
        '$/say': typeof import("./src/apps/$/say");
        'hello-world/say': typeof import("./src/apps/hello-world/say");
    }[Path]["api"]["action"]>[0], headersInit?: Record<string, string> | Headers, options?: import("milkio").ExecuteOptions | undefined) => Promise<import("milkio").ExecuteResult<Result>>;
    executeToJson: <Path_1 extends "cookbook" | "a-sandbox/sandbox" | "$/default" | "$/say" | "hello-world/say">(path: Path_1, params: string | Parameters<{
        cookbook: typeof import("./src/apps/cookbook");
        'a-sandbox/sandbox': typeof import("./src/apps/a-sandbox/sandbox");
        '$/default': typeof import("./src/apps/$/default");
        '$/say': typeof import("./src/apps/$/say");
        'hello-world/say': typeof import("./src/apps/hello-world/say");
    }[Path_1]["api"]["action"]>[0], headersInit?: Record<string, string> | Headers, options?: import("milkio").ExecuteOptions | undefined) => Promise<string>;
    _executeCore: <Path_2 extends "cookbook" | "a-sandbox/sandbox" | "$/default" | "$/say" | "hello-world/say", Result_1 extends Awaited<ReturnType<{
        cookbook: typeof import("./src/apps/cookbook");
        'a-sandbox/sandbox': typeof import("./src/apps/a-sandbox/sandbox");
        '$/default': typeof import("./src/apps/$/default");
        '$/say': typeof import("./src/apps/$/say");
        'hello-world/say': typeof import("./src/apps/hello-world/say");
    }[Path_2]["api"]["action"]>>>(path: Path_2, params: string | Parameters<{
        cookbook: typeof import("./src/apps/cookbook");
        'a-sandbox/sandbox': typeof import("./src/apps/a-sandbox/sandbox");
        '$/default': typeof import("./src/apps/$/default");
        '$/say': typeof import("./src/apps/$/say");
        'hello-world/say': typeof import("./src/apps/hello-world/say");
    }[Path_2]["api"]["action"]>[0], headersInit: Record<string, string> | Headers | undefined, options: import("milkio").ExecuteCoreOptions) => Promise<import("milkio").ExecuteResult<Result_1>>;
    _executeCoreToJson: <Path_3 extends "cookbook" | "a-sandbox/sandbox" | "$/default" | "$/say" | "hello-world/say">(path: Path_3, params: string | Parameters<{
        cookbook: typeof import("./src/apps/cookbook");
        'a-sandbox/sandbox': typeof import("./src/apps/a-sandbox/sandbox");
        '$/default': typeof import("./src/apps/$/default");
        '$/say': typeof import("./src/apps/$/say");
        'hello-world/say': typeof import("./src/apps/hello-world/say");
    }[Path_3]["api"]["action"]>[0], headersInit: Record<string, string> | Headers | undefined, options: import("milkio").ExecuteCoreOptions) => Promise<string>;
    randParams: typeof import("milkio")._randParams;
}>;
