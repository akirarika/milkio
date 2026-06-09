import type { MilkioWorld } from 'milkio'
import type { generated } from '../../../../.milkio/index.ts'

export default ((world: MilkioWorld<typeof generated>) => {
  world.on('event:fail', async (_event) => {
    throw new Error('intentional test failure')
  })
})
