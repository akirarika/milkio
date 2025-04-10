import { join } from 'node:path'
import { cwd } from 'node:process'
import { exists, mkdir } from 'node:fs/promises'
import { routeSchema } from './route-schema'
import { commandSchema } from './command-schema'
import type { CookbookOptions } from '../utils/cookbook-dto-types'
import { configSchema } from './config-schema'
import { checkPort } from '../utils/check-port'
import killPort from 'kill-port'
import { handlerSchema } from './handler-schema'
import { declares } from './declares'
import { $ } from 'bun'
import consola from 'consola'

let firstGenerate = true

export const generator = {
  async watcher(options: CookbookOptions) {
    let tasks: Array<Promise<void>> = []
    for (const projectName in options.projects) {
      const project = options.projects[projectName]
      if (project.type !== 'milkio') return
      if (firstGenerate) {
        if (!(await checkPort(project.port))) {
          try {
            await killPort(project.port)
          }
          catch (error) { }
        }
      }
      const handler = async () => {
        const paths = {
          cwd: join(cwd(), 'projects', projectName),
          milkio: join(cwd(), 'projects', projectName, '.milkio'),
          milkioRaw: join(cwd(), 'projects', projectName, '.milkio', 'raw'),
          generated: join(cwd(), 'projects', projectName, '.milkio', 'generated'),
        }
        if (!(await exists(paths.milkio))) await mkdir(paths.milkio)
        if (!(await exists(paths.milkioRaw))) await mkdir(paths.milkioRaw)
        if (!(await exists(paths.generated))) await mkdir(paths.generated)

        await (async () => {
          let indexFile = '// index'
          indexFile += `\nimport "./declares.d.ts";`
          indexFile += `\nimport routeSchema from "./route-schema.ts";`
          indexFile += `\nimport commandSchema from "./command-schema.ts";`
          indexFile += `\nimport handlerSchema from "./handler-schema.ts";`
          indexFile += `\nimport type { $rejectCode } from "milkio";`
          indexFile += '\n'
          indexFile += '\nexport const generated = {'
          indexFile += '\n  rejectCode: undefined as unknown as $rejectCode,'
          indexFile += '\n  routeSchema,'
          indexFile += '\n  commandSchema,'
          indexFile += '\n  handlerSchema,'
          indexFile += '\n};'
          await Bun.write(join(paths.milkio, 'index.ts'), indexFile)
        })()

        await Promise.all([
          routeSchema(options, paths, project),
          commandSchema(options, paths, project),
          configSchema(options, paths, project),
          handlerSchema(options, paths, project),
        ])
        await declares(options, paths, project)
      }
      tasks.push(handler())
    }
    await Promise.all(tasks)

    tasks = []
    for (const projectName in options.projects) {
      const project = options.projects[projectName]
      const handler = async () => {
        if (project?.watcher && project.watcher.length > 0) {
          for (const script of project.watcher) {
            consola.start(script)
            await $`${{ raw: script }}`.cwd(join(cwd(), 'projects', projectName))
          }
        }
      }
      tasks.push(handler())
    }
    await Promise.all(tasks)

    firstGenerate = false
  },
}
