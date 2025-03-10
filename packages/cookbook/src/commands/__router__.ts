import { devCommand } from './dev'
import { buildUpgrade } from './upgrade'
import { defaultCommand } from './default'
import { initCommand } from './init'

export const paths = ['dev', 'init', 'build', 'upgrade']

export async function __router__(path: string) {
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
      await buildUpgrade()
      break
    }
    
    default: {
      await defaultCommand()
      break
    }
  }
}