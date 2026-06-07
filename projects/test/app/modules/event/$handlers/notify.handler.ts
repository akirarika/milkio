import type { MilkioWorld } from 'milkio'
import type { generated } from '../../../../.milkio/index.ts'

export default ((world: MilkioWorld<typeof generated>) => {
  world.on('event:notify', async (event) => {
    event.received.push('handler-a')
  })

  world.on('event:approve', async (event) => {
    event.received.push('handler-a')
    event.allow = true
    return true
  })
})