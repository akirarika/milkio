import consola from 'consola'
import { join } from 'node:path'
import { exit, cwd, env } from 'node:process'
import { existsSync } from 'node:fs'
import type { progress } from '../progress'
import { checkPort } from '../utils/check-port'
import { killPort } from '../utils/kill-port'

export async function getCookbookToml(p?: typeof progress) {
  const cookbookToml = Bun.file(join(cwd(), 'cookbook.toml'))
  if (!(await cookbookToml.exists())) {
    consola.error(`The "cookbook.toml" file does not exist in the current directory: ${join(cwd())}`)
    exit(0)
  }
  const options: any = Bun.TOML.parse(await cookbookToml.text());
  if (Object.keys(options.projects).length === 0) {
    consola.error(`For at least one project, check your "cookbook.toml".`)
    exit(0)
  }
  for (const projectName in options.projects) {
    if (!existsSync(join(cwd(), 'projects', projectName, 'package.json'))) {
      consola.error(`This project "${projectName}" does not exist (directory does not exist or there is no package.json), if the project has been deleted, please edit your "cookbook.toml" and delete [projects.${projectName}].`)
      exit(0)
    }
  }
  if (existsSync(join(env.HOME || env.USERPROFILE || "/", 'cookbook.toml'))) {
    const homeCookbookToml = Bun.file(join(env.HOME || env.USERPROFILE || "/", 'cookbook.toml'))
    const homeOptions: any = Bun.TOML.parse(await homeCookbookToml.text());
    if (homeOptions.config) {
      if (!options.config) options.config = {}
      for (const config in homeOptions.config) {
        if (!options.config?.[config]) options.config[config] = homeOptions.config[config]
      }
    }
  }

  if (!(await checkPort(options.general.cookbookPort))) {
    if (p) p.close('')
    consola.info(`Port number ${options.general.cookbookPort} is already occupied. You may have started Cookbook.`)
    const confirm = await consola.prompt('Do you want to try to kill the process that is using the port number?', {
      type: 'confirm',
    })
    if (!confirm) exit(0)
    if (confirm) {
      try {
        await killPort(options.general.cookbookPort)
        await Bun.sleep(768)
      }
      catch (error) { }
      if (!(await checkPort(options.general.cookbookPort))) {
        consola.error(`Attempted to kill the process occupying the port number, but this appears to be ineffective.`)
        await exit(0)
      }
      if (p) p.close('')
    }
  }

  return options
}