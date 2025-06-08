import { exit } from 'node:process'
import { consola } from 'consola'

export const cli = {
  async input(message: string, initial?: string): Promise<string> {
    try {
      const result = await consola.prompt(message, {
        type: 'text',
        placeholder: initial,
        default: initial,
      })
      if (typeof result === 'symbol') exit(0)
      return result
    }
    catch (error) {
      process.exit(0)
    }
  },
  async select(message: string, choices: Array<string>): Promise<string> {
    try {
      const result = await consola.prompt(message, {
        type: 'select',
        options: choices,
      })
      if (typeof result === 'symbol') exit(0)
      return result
    }
    catch (error) {
      process.exit(0)
    }
  },
}
