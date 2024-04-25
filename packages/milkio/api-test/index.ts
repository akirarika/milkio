/* eslint-disable no-constant-condition, @typescript-eslint/no-unsafe-argument, no-console, @typescript-eslint/no-explicit-any */

import schema from "../../../generated/api-schema"
import { useLogger, type MilkioApp } from ".."

export const executeApiTests = async <Path extends Array<keyof (typeof schema)["apiTestsSchema"]>>(app: MilkioApp, path: Path | string | true | 1 | undefined) => {
  console.log(`🥛 Milkio Api Testing..\n`)
  
  let pathArr = [] as Array<string>
  if (!path || path === "1" || path === 1 || path === true) {
    pathArr = Object.keys(schema.apiTestsSchema) as unknown as Path
  } else if (typeof path === "string") {
    pathArr = [path] as Path
  }
  
  const tests = []
  const startedAt = new Date().getTime()

  const apiTestHooks = await import("../../../src/api-test.ts")
  await apiTestHooks.default.onBootstrap()
  
  for (let path of pathArr) {
    if (path.startsWith("/")) path = path.slice(1) as Path[number]

    tests.push(
      // @ts-ignore
      (async () => {
        // @ts-ignore
        const module = await schema.apiTestsSchema[path]().module
        const cases = module.test.getCases()
        let i = 0
        for (const cs of cases) {
          ++i
          const csStartedAt = new Date().getTime()
          const clear = setTimeout(() => {
            console.error(`------`)
            console.error(`❌ TIMEOUT -- More than ${cs.timeout ?? 8192}ms`)
            console.error(`   ${cs.name} | Path: src/apps/${path as string}.ts | Case: ${i}`)
            console.error(`------`)
            throw new Error("")
          }, cs.timeout ?? 8192)
          await cs.handler({
            ...(await apiTestHooks.default.onBefore()) ?? {},
            log: (...args: Array<unknown>) => console.log(...args),
            // @ts-ignore
            execute: async (params: any, headers?: any, options?: any) => app.execute(path, params, headers ?? {}, options),
            executeOther: async (path: any, params: any, headers?: any, options?: any) => app.execute(path, params, headers ?? {}, options),
            randParams: () => app.randParams(path as any),
            randOtherParams: (path: any) => app.randParams(path),
            reject: (message?: string) => {
              console.error(`------`)
              console.error(`❌ REJECT -- ${message ?? "Test not satisfied"}`)
              console.error(`   ${cs.name} | Path: src/apps/${path as string}.ts | Case: ${i} | Time: ${new Date().getTime() - csStartedAt}ms`)
              console.error(`------`)
              throw new Error("")
            }
          } as any)
          clearTimeout(clear)
          console.log(`✅ DIRECT --  ${cs.name} | Path: src/apps/${path as string}.ts | Case: ${i} | Time: ${new Date().getTime() - csStartedAt}ms`)
        }
      })()
    )
  }
  
  await Promise.all(tests)
  
  const endedAt = new Date().getTime()
  
  console.log(`\n✅ All tests passed.`)
  console.log(`🥛 Milkio Api Testing took ${((endedAt - startedAt) / 1000).toFixed(2)}s\n`)
}