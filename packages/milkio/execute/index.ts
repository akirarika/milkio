import { type IValidation } from "typia";
import { TSON } from "@southern-aurora/tson";
import { createId } from "../utils/create-id";
import { reject, type $context, type $meta, type ExecuteOptions, type Logger, type MilkioRuntimeInit, type Results, type GeneratedInit, type MilkioInit, createLogger, exceptionHandler } from "..";

export type MilkioHttpRequest = {
  request: Request;
};

export const __initExecuter = <MilkioRuntime extends MilkioRuntimeInit<MilkioRuntimeInit<MilkioInit>> = MilkioRuntimeInit<MilkioInit>>(generated: GeneratedInit, runtime: MilkioRuntime) => {
  const __call = async (
    routeSchema: any,
    options: {
      createdExecuteId: string;
      createdLogger: Logger;
      path: string;
      headers: Record<string, string> | Headers;
      mixinContext: Record<any, any> | undefined;
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
  ): Promise<{ executeId: string; headers: Headers; params: Record<any, unknown>; results: Results<any>; context: $context; meta: Readonly<$meta>; type: "action" | "stream" }> => {
    const executeId = options.createdExecuteId;
    let headers: Headers;
    if (!(options.headers instanceof Headers)) {
      // @ts-ignore
      headers = new Headers({
        ...options.headers,
      });
    } else {
      headers = options.headers;
    }
    let params: Record<any, unknown>;
    if (options.paramsType === "raw") {
      params = options.params;
      if (typeof params === "undefined") params = {};
    } else {
      if (options.params === "") params = {};
      else {
        try {
          params = TSON.parse(options.params);
        } catch (error) {
          throw reject("PARAMS_TYPE_NOT_SUPPORTED", { expected: "json" });
        }
        if (typeof params === "undefined") params = {};
      }
    }
    if (typeof params !== "object") throw reject("PARAMS_TYPE_NOT_SUPPORTED", { expected: "json" });
    if (options.mixinContext?.detail?.params?.string) options.mixinContext.detail.params.parsed = params; // listen でパースしたパラメータを渡す
    const context = { ...(options.mixinContext ? options.mixinContext : {}) } as unknown as $context;
    const results: Results<unknown> = { value: undefined };

    const module = await routeSchema.module();
    let meta = (module.meta ? module.meta : {}) as unknown as Readonly<$meta>;

    if (!meta.typeSafety || meta.typeSafety.includes("params")) {
      const validation = routeSchema.validateParams(params) as IValidation<any>;
      if (!validation.success) throw reject("PARAMS_TYPE_INCORRECT", { ...validation.errors[0], message: `The value '${validation.errors[0].path}' is '${validation.errors[0].value}', which does not meet '${validation.errors[0].expected}' requirements.` });
    }

    results.value = await module.default.handler(context, params);

    if (!meta.typeSafety || meta.typeSafety.includes("results")) {
      const validation = routeSchema.validateResults(results.value) as IValidation<any>;
      if (!validation.success) throw reject("RESULTS_TYPE_INCORRECT", { ...validation.errors[0], message: `The value '${validation.errors[0].path}' is '${validation.errors[0].value}', which does not meet '${validation.errors[0].expected}' requirements.` });
    }

    return { executeId, headers, params, results, context, meta, type: module.$milkioType };
  };

  const execute = async (path: string, options?: ExecuteOptions): Promise<any> => {
    if (!options) options = {};
    const executeId = createId();
    const logger = createLogger(executeId);
    runtime.runtime.request.set(executeId, { logger: logger });

    try {
      const routeSchema = generated.routeSchema.routes.get(path);
      if (routeSchema === undefined) throw reject("NOT_FOUND", { path: path });

      const executed = await __call(routeSchema, {
        createdExecuteId: executeId,
        createdLogger: logger,
        path: path,
        headers: options.headers ?? {},
        mixinContext: {},
        params: options.params ?? {},
        paramsType: "raw",
      });

      if (routeSchema.type === "stream") {
        // stream
        return [
          undefined,
          (async function* () {
            try {
              for await (const result of executed.results.value) {
                yield [undefined, result];
              }
              return undefined;
            } catch (error) {
              const reject = exceptionHandler(executeId, logger, error);
              const result: any = {};
              result[reject.code] = reject.reject;

              yield [result, undefined];
              return undefined;
            }
          })(),
        ];
      } else {
        // action
        return [undefined, executed.results.value];
      }
    } catch (error) {
      const reject = exceptionHandler(executeId, logger, error);
      const result: any = {};
      result[reject.code] = reject.reject;

      return [result, undefined];
    }
  };

  return {
    __call,
    execute,
  };
};
