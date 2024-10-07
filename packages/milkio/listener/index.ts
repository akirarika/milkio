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
    if (request.method === "OPTIONS") {
      return new Response(undefined, {
        headers: {
          "Access-Control-Allow-Methods": runtime.corsAllowMethods ?? "*",
          "Access-Control-Allow-Origin": runtime.corsAllowOrigin ?? "*",
          "Access-Control-Allow-Headers": runtime.corsAllowHeaders ?? "*",
        },
      });
    }

    if (request.url.endsWith("/generate_204")) {
      return new Response("", {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": runtime.corsAllowMethods ?? "*",
          "Access-Control-Allow-Origin": runtime.corsAllowOrigin ?? "*",
          "Access-Control-Allow-Headers": runtime.corsAllowHeaders ?? "*",
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; time=" + Date.now(),
        },
      });
    }

    const executeId = runtime?.executeIdGenerator ? await runtime.executeIdGenerator(request) : createId();
    const logger = createLogger(runtime, executeId);
    runtime.runtime.request.set(executeId, { logger: logger });
    const response: MilkioHttpResponse = {
      body: "",
      status: 200,
      headers: {
        "Access-Control-Allow-Methods": runtime.corsAllowMethods ?? "*",
        "Access-Control-Allow-Origin": runtime.corsAllowOrigin ?? "*",
        "Access-Control-Allow-Headers": runtime.corsAllowHeaders ?? "*",
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
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

      if (!request.headers.get("Accept")?.startsWith("text/event-stream")) {
        // action
        const routeSchema = generated.routeSchema.routes.get(detail.path.string);
        if (routeSchema === undefined) throw reject("NOT_FOUND", { path: detail.path.string as string });
        if (routeSchema.type !== "action") throw reject("UNACCEPTABLE", { expected: "stream", message: `Not acceptable, the Accept in the request header should be "text/event-stream". If you are using the "@milkio/stargate" package, please add \`type: "stream"\` to the execute options.` });

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
      } else {
        // stream
        const routeSchema = generated.routeSchema.routes.get(detail.path.string);
        if (routeSchema === undefined) throw reject("NOT_FOUND", { path: detail.path.string as string });
        if (routeSchema.type !== "stream") throw reject("UNACCEPTABLE", { expected: "stream", message: `Not acceptable, the Accept in the request header should be "application/json". If you are using the "@milkio/stargate" package, please remove \`type: "stream"\` to the execute options.` });

        const executed = await executer.__call(routeSchema, {
          createdExecuteId: executeId,
          createdLogger: logger,
          path: detail.path.string as string,
          headers: request.headers as Headers,
          mixinContext: { detail },
          params: detail.params.string,
          paramsType: "string",
        });
        let stream: ReadableStream;
        let control: ReadableStreamDirectController | ReadableStreamDefaultController;

        if (typeof Bun !== "undefined") {
          // @ts-ignore: bun
          stream = new ReadableStream({
            type: "direct",
            async pull(controller: ReadableStreamDirectController) {
              control = controller;
              try {
                controller.write(`data:@${JSON.stringify({ success: true, data: undefined, executeId } satisfies MilkioResponseSuccess<any>)}\n\n`);
                for await (const value of executed.results.value) {
                  if (!request.signal.aborted) {
                    const result: string = JSON.stringify([null, TSON.encode(value)]);
                    controller.write(`data:${result}\n\n`);
                  } else {
                    executed.results.value.return(undefined);
                    controller.close();
                  }
                }
              } catch (error) {
                const exception = exceptionHandler(executeId, logger, error);
                const result: any = {};
                result[exception.code] = exception.reject;
                controller.write(`data:${JSON.stringify([TSON.encode(result), null])}\n\n`);
              }
              await new Promise((resolve) => setTimeout(resolve, 0));
              controller.close();
            },
            cancel() {
              control.close();
            },
          });
        } else {
          // node.js or others
          stream = new ReadableStream({
            async pull(controller) {
              control = controller;
              try {
                controller.enqueue(`data:@${JSON.stringify({ success: true, data: undefined, executeId } satisfies MilkioResponseSuccess<any>)}\n\n`);
                for await (const value of executed.results.value) {
                  if (!request.signal.aborted) {
                    const result: string = JSON.stringify([null, TSON.encode(value)]);
                    controller.enqueue(`data:${result}\n\n`);
                  } else {
                    executed.results.value.return(undefined);
                    controller.close();
                  }
                }
              } catch (error) {
                const exception = exceptionHandler(executeId, logger, error);
                const result: any = {};
                result[exception.code] = exception.reject;
                controller.enqueue(`data:${JSON.stringify([TSON.encode(result), null])}\n\n`);
              }
              await new Promise((resolve) => setTimeout(resolve, 0));
              controller.close();
            },
            cancel() {
              control.close();
            },
          });
        }

        response.body = stream;
        response.headers["Content-Type"] = "text/event-stream";
        response.headers["Cache-Control"] = "no-cache";

        runtime.runtime.request.delete(executeId);
        return new Response(response.body, response);
      }
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
