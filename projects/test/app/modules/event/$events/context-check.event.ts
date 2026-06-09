import type { MilkioContext } from '../../../../../.milkio/declares.ts'

export interface _ {
  'event:context-check': {
    context: MilkioContext
    received: string[]
  }
}
