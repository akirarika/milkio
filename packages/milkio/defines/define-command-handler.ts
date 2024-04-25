/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import type { MilkioApp } from ".."

export type CommandOptions = {
  notFoundHandler?: (event: { name: string, path: string, commands: Array<string>, options: Record<string, string | true> }) => void | Promise<void>;
}

export function defineCommandHandler(app: MilkioApp, options: CommandOptions = {}) {
  const call = async (argv: Array<string>) => {
    const params = {
      path: 'default',
      commands: [] as Array<string>,
      options: {} as Record<string, string | true>
    }
    for (const v of argv.slice(3)) {
      if (v.startsWith("--") && v.includes('=')) {
        const vSplited = v.split("=")
        params.options[vSplited[0].slice(2)] = vSplited.slice(1, vSplited.length).join("=")
      } else if (v.startsWith("--")) {
        params.options[v.slice(2)] = true
      } else if (v.startsWith("-") && v.includes('=')) {
        const vSplited = v.split("=")
        params.options[vSplited[0].slice(1)] = vSplited.slice(1, vSplited.length).join("=")
      } else if (v.startsWith("-")) {
        params.options[v.slice(1)] = true
      } else {
        params.commands.push(v)
      }
    }
    if (argv.length === 2) params.path = `$/default`
    else params.path = `$/${argv[2]}`

    // @ts-ignore
    const result = await app.execute(params.path as any, params)
    if (!result.success) {
      if (result.fail.code === 'NOT_FOUND') {
        if (options.notFoundHandler) await options.notFoundHandler({ ...params, name: argv.length === 2 ? 'default' : argv[2] })
        return
      }
      if (result.fail.code !== 'INTERNAL_SERVER_ERROR') {
        console.log(result.fail.message)
        return
      }
    }
  }

  return call
}