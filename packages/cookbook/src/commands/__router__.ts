import { packageJson } from '../utils/package-json'
import { devCommand } from './dev'
import { upgradeCommand } from './upgrade'
import { defaultCommand } from './default'
import { initCommand } from './init'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { execFileSync } from 'node:child_process'
import { env } from 'bun'

export const paths = ['dev', 'init', 'upgrade']

export async function __router__(path: string) {
  // During the development of the cookbook, the cookbook itself is built
  if (env.COOKBOOK_PRODUCTION === 'true' && existsSync(join(cwd(), 'packages', 'cookbook', 'src', 'ui', 'README.md'))) {
    execFileSync("powershell.exe", ["-Command", `bun run ./.commands/develop.ts`], { stdio: "inherit", shell: true, env: { ...process.env } });
    execFileSync("powershell.exe", ["-Command", `bun run ./packages/cookbook/cookbook.ts ${path}`], { stdio: "inherit", shell: true, env: { ...process.env } });
    return
  }

  switch (path) {
    case 'dev': {
      await devCommand()
      break
    }

    case 'init': {
      await initCommand()
      break
    }

    case 'upgrade': {
      await upgradeCommand()
      break
    }

    case 'version': {
      console.log(packageJson.version)
      break
    }
    
    default: {
      await defaultCommand()
      break
    }
  }
}