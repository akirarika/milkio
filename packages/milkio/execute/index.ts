import type { IValidation } from "typia";
import { reject } from "../index.ts";
import type { $context, $meta, Logger, Results, GeneratedInit } from "../index.ts";
import { headersToJSON } from "../utils/headers-to-json.ts";
import { mergeDeep } from "../utils/merge-deep.ts";

export function __initExecuter(generated: GeneratedInit, runtime: any) {
    const __execute = async (
        routeSchema: any,
        options: {
            createdExecuteId: string;
            createdLogger: Logger;
            path: string;
            headers: Record<string, string> | Headers;
            context: any | undefined;
        } & (
                | {
                    params: Record<any, any>;
                    paramsType: "raw";
                }
                | {
                    params: string;
                    paramsType: "string";
                }
            ),
    ): Promise<{ executeId: string; headers: Headers; params: Record<any, unknown>; results: Results<any>; context: $context; meta: Readonly<$meta>; type: "action" | "stream"; emptyResult: boolean; resultsTypeSafety: boolean; finales: Array<() => void | Promise<void>> }> => {
        const type = options.path.endsWith("~") ? "stream" : "action";
        const executeId: string = options.createdExecuteId;
        let headers: Headers;
        if (!(options.headers instanceof Headers)) {
            // @ts-ignore
            headers = new Headers({
                ...options.headers,
            });
        } else {
            headers = options.headers;
        }
        if (!("toJSON" in headers)) (headers as any).toJSON = () => headersToJSON(headers);

        const finales: Array<any> = [];
        const onFinally = (handler: any) => finales.unshift(handler);

        let params: Record<any, unknown>;
        if (options.paramsType === "raw") {
            params = options.params;
            if (typeof params === "undefined") params = {};
        } else {
            if (options.params === "") {
                params = {};
            } else {
                try {
                    params = JSON.parse(options.params);
                } catch (error) {
                    throw reject("PARAMS_TYPE_NOT_SUPPORTED", { expected: "json" });
                }
                if (typeof params === "undefined") params = {};
            }
        }
        if (typeof params !== "object" || Array.isArray(params)) throw reject("PARAMS_TYPE_NOT_SUPPORTED", { expected: "json" });
        if ("$milkioGenerateParams" in params && params.$milkioGenerateParams === "enable") {
            if (!runtime.develop) throw reject("NOT_DEVELOP_MODE", "This feature must be in cookbook to use.");
            delete params.$milkioGenerateParams;
            let paramsRand = routeSchema.randomParams();
            if (paramsRand === undefined || paramsRand === null) paramsRand = {};
            params = mergeDeep(params, paramsRand);
            options.createdLogger.debug("✨ the generated params:", JSON.stringify(params));
        }
        if (!options.context?.http?.notFound && options.context?.http?.params?.string) options.context.http.params.parsed = params;

        if (!options.context) options.context = {};
        options.context.develop = runtime.develop;
        options.context.path = options.path;
        options.context.logger = options.createdLogger;
        options.context.emit = runtime.emit;
        options.context.executeId = options.createdExecuteId;
        options.context.config = runtime.runtime.config;
        options.context.typia = generated.typiaSchema;
        options.context.call = (module: any, params: any) => __call(options.context, module, params);
        options.context.onFinally = onFinally;
        options.context._ = runtime;

        const results: Results<any> = { value: undefined };

        const module = routeSchema.module;
        const meta = (module?.meta ? module?.meta : {}) as unknown as Readonly<$meta>;

        if (options.context.http?.request?.method !== undefined) {
            const allowMethods = meta?.methods ?? ["POST"];
            if (!allowMethods.includes(options.context.http.request.method)) throw reject("METHOD_NOT_ALLOWED", undefined);
        }

        if (meta?.typeSafety === undefined || meta.typeSafety === true || (Array.isArray(meta.typeSafety) && meta.typeSafety.includes("params"))) {
            const validation = routeSchema.validateParams(params) as IValidation<any>;
            if (!validation.success) throw reject("PARAMS_TYPE_INCORRECT", { ...validation.errors[0], message: `The value '${validation.errors[0].path}' is '${validation.errors[0].value}', which does not meet '${validation.errors[0].expected}' requirements.` });
        }

        await runtime.emit("milkio:executeBefore", { executeId: options.createdExecuteId, logger: options.createdLogger, path: options.path, meta, context: options.context, reject });

        results.value = await module.handler(options.context, params);

        let emptyResult = false;
        if (results.value === undefined || results.value === null || results.value === "") {
            emptyResult = true;
            results.value = {};
        } else if (Array.isArray(results.value) || typeof results.value !== "object") {
            throw reject("REQUEST_FAIL", "The return type of the handler must be an 'object', which is currently an '${typeof typeof results.value}'.");
        }

        let resultsTypeSafety = false;
        if (!emptyResult && type === "action" && (
            // Temporary: type-safe default is false and this setting should not be exposed to users
            // Due to current issues with typia, type safety cannot be achieved at the moment
            // Therefore, the next line of code is currently commented out
            // This means Milkio is using traditional JSON.stringify for result serialization
            // meta?.typeSafety === undefined || 
            // @ts-ignore
            meta.typeSafety === true || (Array.isArray(meta.typeSafety) && meta.typeSafety.includes("results")))) {
            resultsTypeSafety = true;
            const validation = routeSchema.validateResults(results.value) as IValidation<any>;
            if (!validation.success) throw reject("RESULTS_TYPE_INCORRECT", { ...validation.errors[0], message: `The value '${validation.errors[0].path}' is '${validation.errors[0].value}', which does not meet '${validation.errors[0].expected}' requirements.` });
        }

        await runtime.emit("milkio:executeAfter", { executeId: options.createdExecuteId, logger: options.createdLogger, path: options.path, meta, context: options.context, results, reject });

        return { executeId, headers, params, results, context: options.context, meta, type, emptyResult, resultsTypeSafety, finales };
    };

    const __call = async (context: $context, module: { meta: any, handler: any }, params?: any): Promise<any> => {
        const moduleAwaited = await module;
        return await moduleAwaited.handler(context, params);
    };

    return {
        __call,
        __execute,
    };
}
