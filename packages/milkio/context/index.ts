import type { MilkioHttpRequest, MilkioHttpResponse, $types, Logger, Action, MilkioRuntimeInit, MilkioInit } from "../index.ts";

export interface MilkioContext {
    _: MilkioRuntimeInit<MilkioInit>;
    develop: boolean;
    executeId: string;
    emit: MilkioRuntimeInit<MilkioInit>["emit"];
    path: string;
    logger: Logger;
    http: ContextHttp<Record<any, any>>;
    headers: Headers;
    config: Readonly<Awaited<ReturnType<$types["configSchema"]["get"]>>>;
    typia: Readonly<$types["generated"]["typiaSchema"]>;
    call: <Module extends Promise<{ default: Action<any> }>>(module: Module, params: Parameters<Awaited<Module>["default"]["handler"]>[1]) => Promise<ReturnType<Awaited<Module>["default"]["handler"]>>;
    onFinally: (handler: () => void | Promise<void>) => void;
}

export interface ContextHttp<ParamsParsed = any> {
    url: URL;
    ip: string;
    path: { string: keyof $types["generated"]["routeSchema"]; array: Array<string> };
    params: {
        string: string;
        parsed: ParamsParsed;
    };
    request: MilkioHttpRequest;
    response: MilkioHttpResponse;
}

export type ContextCreatedHandler = (context: MilkioContext) => Promise<void> | void;
