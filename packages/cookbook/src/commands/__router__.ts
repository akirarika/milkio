import { devCommand } from './dev'
import { upgradeCommand } from './upgrade'
import { defaultCommand } from './default'
import { initCommand } from './init'

export const paths = ['dev', 'init', 'upgrade']

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
      await upgradeCommand()
      break
    }
    
    default: {
      await defaultCommand()
      break
    }
  }
}