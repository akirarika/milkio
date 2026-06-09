import type { MilkioWorld } from 'milkio'
import type { generated } from '../../../../.milkio/index.ts'

export default ((world: MilkioWorld<typeof generated>) => {
  world.on('event:context-check', async (event) => {
    if (event.context?.reject && event.context?.emit) {
      event.received.push('context-ok')
    }
  })
})
