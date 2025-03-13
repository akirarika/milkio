import { packageJson } from '../utils/package-json'
import { devCommand } from './dev'
import { upgradeCommand } from './upgrade'
import { defaultCommand } from './default'
import { initCommand } from './init'

export const paths = ['dev', 'init', 'upgrade']

export async function __router__(path: string) {
  if (path === 'version' || path === '--version' || path === '-v') return console.log(packageJson.version)
  if (path === 'dev') return devCommand()
  if (path === 'init') return initCommand()
  if (path === 'upgrade') return upgradeCommand()
  return defaultCommand()
}