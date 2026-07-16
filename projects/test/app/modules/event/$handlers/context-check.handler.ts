import type { MilkioWorld } from 'milkio'
import type { generated } from '../../../../.milkio/index.ts'

export default ((world: MilkioWorld<typeof generated>) => {
  world.on('event:context-check', async (event) => {
    if (typeof event.context?.reject === 'function' && typeof event.context?.emit === 'function') {
      event.received.push('context-ok')
    }
  })
})
