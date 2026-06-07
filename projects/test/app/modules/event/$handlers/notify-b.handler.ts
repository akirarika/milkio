import type { MilkioWorld } from 'milkio'
import type { generated } from '../../../../.milkio/index.ts'

export default ((world: MilkioWorld<typeof generated>) => {
  world.on('event:notify', async (event) => {
    event.received.push('handler-b')
  })

  world.on('event:approve', async (event) => {
    event.received.push('handler-b')
    event.allow = true
    return true
  })
})