import { TSON } from '@southern-aurora/tson'
import { createLogger, exceptionHandler, reject } from '..'
import type { Mixin, GeneratedInit, $types, ContextHttp, MilkioResponseReject, Results, MilkioResponseSuccess } from '..'
import type { __initExecuter } from '../execute'
import { createId } from '../utils/create-id'

export type MilkioHttpRequest = Request

export type MilkioHttpResponse = Mixin<
  ResponseInit,
  {
    body: string | Blob | FormData | URLSearchParams | ReadableStream<Uint8Array>
    status: number
    headers: Record<string, string>
  }
>

export function __initListener(generated: GeneratedInit, runtime: any, executer: ReturnType<typeof __initExecuter>) {
  const port = runtime.port
  const fetch = async (options: {
    request: MilkioHttpRequest
    envMode?: string
    env?: Record<any, any>
  }): Promise<Response> => {
    if (options.request.method === 'OPTIONS') {
      return new Response(undefined, {
        headers: {
          'Access-Control-Allow-Methods': runtime.cors?.corsAllowMethods ?? '*',
          'Access-Control-Allow-Origin': runtime.cors?.corsAllowOrigin ?? '*',
          'Access-Control-Allow-Headers': runtime.cors?.corsAllowHeaders ?? '*',
        },
      })
    }

    if (options.request.url.endsWith('/generate_204')) {
      return new Response('', {
        status: 204,
        headers: {
          'Access-Control-Allow-Methods': runtime.cors?.corsAllowMethods ?? '*',
          'Access-Control-Allow-Origin': runtime.cors?.corsAllowOrigin ?? '*',
          'Access-Control-Allow-Headers': runtime.cors?.corsAllowHeaders ?? '*',
          'Cache-Control': 'no-store',
          'Content-Type': `text/plain; time=${Date.now()}`,
        },
      })
    }

    const url = new URL(options.request.url)
    let pathArray = url.pathname.substring(1).split('/')
    if (runtime.ignorePathLevel !== undefined && runtime.ignorePathLevel !== 0) pathArray = pathArray.slice(runtime.ignorePathLevel)
    const pathString = `/${pathArray.join('/')}`

    const executeId = runtime?.executeId ? await runtime.executeId(options.request) : createId()
    console.log('executeId', await runtime.executeId(options.request), createId())

    const logger = createLogger(runtime, pathString, executeId)
    runtime.runtime.request.set(executeId, { logger })
    const response: MilkioHttpResponse = {
      body: '',
      status: 200,
      headers: {
        'Access-Control-Allow-Methods': runtime.cors?.corsAllowMethods ?? '*',
        'Access-Control-Allow-Origin': runtime.cors?.corsAllowOrigin ?? '*',
        'Access-Control-Allow-Headers': runtime.cors?.corsAllowHeaders ?? '*',
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    }
    
    let finales: Array<() => void | Promise<void>> = []

    try {
      const http = (await (async () => {
        const ip = runtime.realIp ? runtime.realIp(options.request) : '::1'
        const params = {
          string: await options.request.text(),
          parsed: undefined,
        }

        return {
          url,
          ip,
          path: { string: pathString as keyof $types['generated']['routeSchema'], array: pathArray },
          params,
          request: options.request,
          response,
        } as ContextHttp
      })())!

      await runtime.emit('milkio:httpRequest', { executeId, logger, path: http.path.string as string, http })

      if (!runtime.develop && ((http.path.string as string).startsWith('/_/'))) {
        await runtime.emit('milkio:httpNotFound', { executeId, logger, path: http.path.string as string, http })
        throw reject('NOT_FOUND', { path: http.path.string as string })
      }

      if (!options.request.headers.get('Accept')?.startsWith('text/event-stream')) {
        // action
        const routeSchema = generated.routeSchema[http.path.string]
        if (routeSchema === undefined) {
          await runtime.emit('milkio:httpNotFound', { executeId, logger, path: http.path.string as string, http })
          throw reject('NOT_FOUND', { path: http.path.string as string })
        }
        if (routeSchema.type !== 'action') throw reject('UNACCEPTABLE', { expected: 'stream', message: `Not acceptable, the Accept in the request header should be "text/event-stream". If you are using the "@milkio/stargate" package, please add \`type: "stream"\` to the execute options.` })

        const executed = await executer.__execute(routeSchema, {
          createdExecuteId: executeId,
          createdLogger: logger,
          path: http.path.string as string,
          headers: options.request.headers as Headers,
          mixinContext: { http },
          params: http.params.string,
          paramsType: 'string',
        })
        finales = executed.finales;

        if (response.body === '' && executed.results.value !== undefined) {
          if (executed.emptyResult) {
            response.body = `{"data":{},"executeId":"${executeId}","success":true}`
          }
          else if (executed.resultsTypeSafety) {
            response.body = `{"data":${routeSchema.resultsToJSON(executed.results.value)},"executeId":"${executeId}","success":true}`
          }
          else {
            response.body = `{"data":${TSON.stringify(executed.results.value)},"executeId":"${executeId}","success":true}`
          }
        }

        await runtime.emit('milkio:httpResponse', { executeId, logger, path: http.path.string as string, http, context: executed.context })
        
        for (const handler of finales) {
          try {
            await handler()
          } catch (error) {
            logger.error('An error occurred inside onFinally.', error)
          }
        }

        runtime.runtime.request.delete(executeId)
        return new Response(response.body, response)
      }
      else {
        // stream
        const routeSchema = generated.routeSchema[http.path.string]
        if (routeSchema === undefined) throw reject('NOT_FOUND', { path: http.path.string as string })
        if (routeSchema.type !== 'stream') throw reject('UNACCEPTABLE', { expected: 'stream', message: `Not acceptable, the Accept in the request header should be "application/json". If you are using the "@milkio/stargate" package, please remove \`type: "stream"\` to the execute options.` })


        const handleClose = async () => {
          runtime.runtime.request.delete(executeId)
          for (const handler of finales) {
            try {
              await handler()
            } catch (error) {
              logger.error('An error occurred inside onFinally.', error)
            }
          }
        }

        const executed = await executer.__execute(routeSchema, {
          createdExecuteId: executeId,
          createdLogger: logger,
          path: http.path.string as string,
          headers: options.request.headers as Headers,
          mixinContext: { http },
          params: http.params.string,
          paramsType: 'string',
        })
        finales = executed.finales;
        let stream: ReadableStream
        let control: ReadableStreamDirectController | ReadableStreamDefaultController

        if (typeof Bun !== 'undefined') {
          // @ts-ignore: bun
          stream = new ReadableStream({
            type: 'direct',
            async pull(controller: ReadableStreamDirectController) {
              control = controller
              try {
                controller.write(`data:@${JSON.stringify({ success: true, data: undefined, executeId } satisfies MilkioResponseSuccess<any>)}\n\n`)
                for await (const value of executed.results.value) {
                  if (!options.request.signal.aborted) {
                    const result: string = JSON.stringify([null, TSON.encode(value)])
                    controller.write(`data:${result}\n\n`)
                  }
                  else {
                    executed.results.value.return(undefined)
                    await handleClose()
                    controller.close()
                  }
                }
              }
              catch (error) {
                const exception = exceptionHandler(executeId, logger, error)
                const result: any = {}
                result[exception.code] = exception.reject
                controller.write(`data:${JSON.stringify([TSON.encode(result), null])}\n\n`)
              }
              await new Promise(resolve => setTimeout(resolve, 0))
              await handleClose()
              controller.close()
            },
            async cancel() {
              await handleClose()
              control.close()
            },
          })
        }
        else {
          // node.js or others
          stream = new ReadableStream({
            async pull(controller) {
              control = controller
              try {
                controller.enqueue(`data:@${JSON.stringify({ success: true, data: undefined, executeId } satisfies MilkioResponseSuccess<any>)}\n\n`)
                for await (const value of executed.results.value) {
                  if (!options.request.signal.aborted) {
                    const result: string = JSON.stringify([null, TSON.encode(value)])
                    controller.enqueue(`data:${result}\n\n`)
                  }
                  else {
                    executed.results.value.return(undefined)
                    await handleClose()
                    controller.close()
                  }
                }
              }
              catch (error) {
                const exception = exceptionHandler(executeId, logger, error)
                const result: any = {}
                result[exception.code] = exception.reject
                controller.enqueue(`data:${JSON.stringify([TSON.encode(result), null])}\n\n`)
              }
              await handleClose()
              await new Promise(resolve => setTimeout(resolve, 0))
              controller.close()
            },
            async cancel() {
              await handleClose()
              control.close()
            },
          })
        }

        response.body = stream
        response.headers['Content-Type'] = 'text/event-stream'
        response.headers['Cache-Control'] = 'no-cache'

        await runtime.emit('milkio:httpResponse', { executeId, logger, path: http.path.string as string, http, context: executed.context })

        return new Response(response.body, response)
      }
    }
    catch (error) {
      const results: Results<MilkioResponseReject> = {
        value: exceptionHandler(executeId, logger, error),
      }
      if (results.value !== undefined) response.body = TSON.stringify(results.value)

      runtime.runtime.request.delete(executeId)
      return new Response(response.body, response)
    }
  }

  return {
    port,
    fetch,
  }
}
