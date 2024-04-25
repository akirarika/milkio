/* eslint-disable no-console */
import { loggerPushTags, loggerSubmit, useLogger, runtime, MiddlewareEvent } from ".."
import type { ExecuteId, MilkioApp, Mixin } from ".."
import { hanldeCatchError } from "../utils/handle-catch-error"
import { routerHandler } from "../../../src/router"
import schema from "../../../generated/api-schema"
import { failCode } from "../../../src/fail-code"
import { TSON } from "@southern-aurora/tson"
import { createUlid } from "../utils/create-ulid"
import { configMilkio } from "../../../src/config/milkio"
import { headerToPlainObject } from "../utils/header-to-plain-object"

export type ExecuteHttpServerOptions = {
  /**
   * The execution ID generator
   * If you have enabled this option, the executeId will be generated each time by calling this method. Otherwise, it will be generated using the built-in method.
   *
   * @param request
   * @returns
   */
  executeIdGenerator?: (request: Request) => string | Promise<string>;
};

export function defineHttpHandler(app: MilkioApp, options: ExecuteHttpServerOptions = {}) {
  const fetch = async (request: MilkioHTTPRequest) => {
    const fullurl = new URL(request.request.url, `http://${request.request.headers.get("host") ?? "localhost"}`)
    const executeId = (options?.executeIdGenerator ? await options.executeIdGenerator(request.request) : createUlid()) as ExecuteId
    runtime.execute.executeIds.add(executeId)
    const logger = useLogger(executeId)
    const ip = (request.request.headers.get("x-forwarded-for") as string | undefined)?.split(",")[0] ?? "0.0.0.0"
    const headers = request.request.headers

    loggerPushTags(executeId, {
      from: "http-server",
      fullUrl: fullurl.pathname,
      ip,
      method: request.request.method,
      // @ts-ignore
      requestHeaders: headerToPlainObject(request.request.headers),
      timein: new Date().getTime()
    })

    const response: MilkioHTTPResponse = {
      body: "",
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Methods": configMilkio.corsAllowMethods ?? "*",
        "Access-Control-Allow-Headers": configMilkio.corsAllowHeaders ?? "*",
        "Access-Control-Allow-Origin": configMilkio.corsAllowOrigin ?? "*"
      }
    }

    try {
      // Process OPTIONS pre inspection requests
      if (request.request.method === "OPTIONS") {
        await loggerSubmit(executeId)
        runtime.execute.executeIds.delete(executeId)

        return new Response("", {
          headers: {
            "Access-Control-Allow-Methods": configMilkio.corsAllowMethods ?? "*",
            "Access-Control-Allow-Headers": configMilkio.corsAllowHeaders ?? "*",
            "Access-Control-Allow-Origin": configMilkio.corsAllowOrigin ?? "*"
          }
        })
      }

      let path = fullurl.pathname.substring(1).split("/")

      // Compatible with API gateway's ability to differentiate versions by path
      // see: /src/config/ConfigProgram.ts in "ignorePathLevel"
      if (configMilkio.ignorePathLevel !== 0) path = path.slice(configMilkio.ignorePathLevel)

      let pathstr = path.join("/") as keyof (typeof schema)["apiMethodsSchema"]

      // Special processing: do not run middleware when encountering 404 and return quickly
      if (!(pathstr in schema.apiMethodsSchema) || pathstr.startsWith('$/')) {
        // @ts-ignore
        const redirectPath = await routerHandler(pathstr, fullurl)
        if (!redirectPath) {
          const rawbody = await request.request.text()
          loggerPushTags(executeId, {
            body: rawbody || "no body"
          })
          if (!response.body) response.body = `{"executeId":"${executeId}","success":false,"fail":{"code":"NOT_FOUND","message":${JSON.stringify(failCode.NOT_FOUND())}}}`

          loggerPushTags(executeId, {
            status: response.status,
            responseHeaders: response.headers,
            timeout: new Date().getTime()
          })

          await loggerSubmit(executeId)
          runtime.execute.executeIds.delete(executeId)

          return new Response(response.body, response)
        }
        pathstr = redirectPath as typeof pathstr
      }

      loggerPushTags(executeId, {
        path: pathstr
      })

      const detail = {
        path: pathstr,
        ip,
        executeId,
        fullurl,
        request: request.request,
        response
      }

      // execute api
      // after request middleware
      await MiddlewareEvent.handle("afterHTTPRequest", [headers, detail])

      const rawbody = await request.request.text()
      loggerPushTags(executeId, {
        body: rawbody || "no body"
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let params: any
      if (rawbody === "") {
        params = undefined
      } else {
        try {
          params = JSON.parse(rawbody)
        } catch (error) {
          const logger = useLogger(executeId)
          logger.log("TIP: body is not json, the content is not empty, but the content is not in a valid JSON format. The original content value can be retrieved via request.request.text()")
          params = undefined
        }
      }

      loggerPushTags(executeId, {
        params
      })

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      // @ts-ignore
      const result = await app._executeCoreToJson(pathstr, params, headers, {
        executeId,
        logger,
        detail
      })

      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-explicit-any
      if (!response.body) response.body = result

      // before response middleware
      const middlewareResponse = {
        value: response.body
      }
      await MiddlewareEvent.handle("beforeHTTPResponse", [middlewareResponse, detail])

      if (!response.body) response.body = middlewareResponse.value
    } catch (error) {
      const result = hanldeCatchError(error, executeId)
      if (!response.body) response.body = TSON.stringify(result)
    }

    loggerPushTags(executeId, {
      status: response.status,
      responseHeaders: response.headers,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      body: response.body?.toString() ?? "",
      timeout: new Date().getTime()
    })

    await loggerSubmit(executeId)
    runtime.execute.executeIds.delete(executeId)

    return new Response(response.body, response)
  }

  return fetch
}

export type MilkioHTTPRequest = {
  request: Request;
};

export type MilkioHTTPResponse = Mixin<
  ResponseInit,
  {
    body: string | BodyInit;
    status: number;
    headers: Record<string, string>;
  }
>;
