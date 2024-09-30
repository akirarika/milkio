declare const _default: {
    client: () => {
        options: import("milkio-project-client").MilkioClientOptions;
        execute<Path extends "api-tests/stream" | "api-tests/default" | "api-tests/steps", Params extends Awaited<Parameters<{
            'api-tests/stream': typeof import("./apps/api-tests/stream");
            'api-tests/default': typeof import("./apps/api-tests/default");
            'api-tests/steps': typeof import("./apps/api-tests/steps");
        }[Path]["api"]["action"]>[0]>>(path: Path, executeOptions: {
            params: Params;
        } & import("milkio-project-client").ExecuteOptions): Promise<{
            success: false;
            executeId: string;
            fail: {
                code: "NETWORK_ERROR" | "INTERNAL_SERVER_ERROR" | "NOT_FOUND" | "NOT_ALLOW_METHOD" | "BUSINESS_FAIL";
                fromClient: true | undefined;
                message: string;
                data: any;
            };
        } | {
            success: true;
            executeId: string;
            data: Awaited<ReturnType<{
                'api-tests/stream': typeof import("./apps/api-tests/stream");
                'api-tests/default': typeof import("./apps/api-tests/default");
                'api-tests/steps': typeof import("./apps/api-tests/steps");
            }[Path]["api"]["action"]>>;
        } | {
            success: false;
            executeId: string;
            fail: {
                code: "TYPE_SAFE_ERROR";
                fromClient: true | undefined;
                message: string;
                data: {
                    path: "$input" | import("milkio-project-client").FlattenKeys<Awaited<Parameters<{
                        'api-tests/stream': typeof import("./apps/api-tests/stream");
                        'api-tests/default': typeof import("./apps/api-tests/default");
                        'api-tests/steps': typeof import("./apps/api-tests/steps");
                    }[Path]["api"]["action"]>[0]>, "">;
                    expected: string;
                    value: any;
                };
            };
        }>;
        executeStream<Path extends "api-tests/stream" | "api-tests/default" | "api-tests/steps", Params extends Awaited<Parameters<{
            'api-tests/stream': typeof import("./apps/api-tests/stream");
            'api-tests/default': typeof import("./apps/api-tests/default");
            'api-tests/steps': typeof import("./apps/api-tests/steps");
        }[Path]["api"]["action"]>[0]>, TypeSafeErrorPath extends keyof Awaited<Parameters<{
            'api-tests/stream': typeof import("./apps/api-tests/stream");
            'api-tests/default': typeof import("./apps/api-tests/default");
            'api-tests/steps': typeof import("./apps/api-tests/steps");
        }[Path]["api"]["action"]>[0]> = keyof Awaited<Parameters<{
            'api-tests/stream': typeof import("./apps/api-tests/stream");
            'api-tests/default': typeof import("./apps/api-tests/default");
            'api-tests/steps': typeof import("./apps/api-tests/steps");
        }[Path]["api"]["action"]>[0]>>(path: Path, eventOptions: {
            params: Params;
        } & import("milkio-project-client").ExecuteStreamOptions): {
            stream: AsyncGenerator<Awaited<import("milkio-project-client").GeneratorGeneric<Awaited<ReturnType<{
                'api-tests/stream': typeof import("./apps/api-tests/stream");
                'api-tests/default': typeof import("./apps/api-tests/default");
                'api-tests/steps': typeof import("./apps/api-tests/steps");
            }[Path]["api"]["action"]>>>>, any, unknown>;
            getResult: () => {
                success: true;
                executeId: string;
            } | {
                success: false;
                executeId: string;
                fromClient: true | undefined;
                fail: {
                    code: "NETWORK_ERROR" | "INTERNAL_SERVER_ERROR" | "NOT_FOUND" | "NOT_ALLOW_METHOD" | "BUSINESS_FAIL";
                    message: string;
                    data: any;
                };
            } | {
                success: false;
                executeId: string;
                fail: {
                    code: "TYPE_SAFE_ERROR";
                    fromClient: true | undefined;
                    message: string;
                    data: {
                        path: "$input" | import("milkio-project-client").FlattenKeys<TypeSafeErrorPath, "">;
                        expected: string;
                        value: any;
                    };
                };
            };
        };
    };
    onBootstrap(): Promise<void>;
    onBefore(): Promise<{}>;
};
export default _default;
