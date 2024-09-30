import { TSON } from "@southern-aurora/tson";
import { type $context, type MilkioRuntimeInit, type Mixin, type GeneratedInit, type MilkioInit, type $types, createLogger, type ContextHttp, exceptionHandler, type MilkioResponseReject, type Results, type MilkioResponseSuccess, reject } from "..";
import { type __initExecuter } from "../execute";
import { createId } from "../utils/create-id";

export type MilkioHttpRequest = Request;

export type MilkioHttpResponse = Mixin<
  ResponseInit,
  {
    body: string | Blob | FormData | URLSearchParams | ReadableStream<Uint8Array>;
    status: number;
    headers: Record<string, string>;
  }
>;

export const __initListener = <MilkioRuntime extends MilkioRuntimeInit<MilkioRuntimeInit<MilkioInit>> = MilkioRuntimeInit<MilkioInit>>(generated: GeneratedInit, runtime: MilkioRuntime, executer: ReturnType<typeof __initExecuter>) => {
  const port = runtime.port.app;
  const fetch = async (request: MilkioHttpRequest): Promise<Response> => {
    const executeId = runtime?.executeIdGenerator ? await runtime.executeIdGenerator(request) : createId();
    const logger = createLogger(executeId);
    runtime.runtime.request.set(executeId, { logger: logger });
    const response: MilkioHttpResponse = {
      body: "",
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*",
      },
    };
    try {
      const detail = (await (async () => {
        const url = new URL(request.url);
        let pathArray = url.pathname.substring(1).split("/");
        if (runtime.ignorePathLevel !== undefined && runtime.ignorePathLevel !== 0) pathArray = pathArray.slice(runtime.ignorePathLevel);
        const pathString = `/${pathArray.join("/")}`;
        const ip = runtime.getRealIp ? runtime.getRealIp(request) : "::1";
        const params = {
          string: await request.text(),
          parsed: undefined,
        };

        return {
          url,
          path: { string: pathString as keyof $types["generated"]["routeSchema"]["$types"], array: pathArray },
          ip,
          params,
        } as ContextHttp<undefined>;
      })())!;

      const routeSchema = generated.routeSchema.routes.get(detail.path.string);
      if (routeSchema === undefined) throw reject("NOT_FOUND", { path: detail.path.string as string });
      const executed = await executer.__call(routeSchema, {
        createdExecuteId: executeId,
        createdLogger: logger,
        path: detail.path.string as string,
        headers: request.headers as Headers,
        mixinContext: { detail },
        params: detail.params.string,
        paramsType: "string",
      });

      if (executed.results.value !== undefined) response.body = TSON.stringify({ success: true, data: executed.results.value, executeId } satisfies MilkioResponseSuccess<any>);

      runtime.runtime.request.delete(executeId);
      return new Response(response.body, response);
    } catch (error) {
      const results: Results<MilkioResponseReject> = {
        value: exceptionHandler(executeId, logger, error),
      };
      if (results.value !== undefined) response.body = TSON.stringify(results.value);

      runtime.runtime.request.delete(executeId);
      return new Response(response.body, response);
    }
  };

  return {
    port,
    fetch,
  };
};
