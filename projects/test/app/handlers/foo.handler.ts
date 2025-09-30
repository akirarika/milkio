import { reject, type MilkioWorld } from 'milkio'
import type { generated } from '../../.milkio/index.ts'

export default ((world: MilkioWorld<typeof generated>) => {
    world.on('milkio:executeBefore', async (event) => {
        if (!event.context) throw reject('REQUEST_FAIL', 'Event is not \'context\'')
        if (!event.executeId) throw reject('REQUEST_FAIL', 'Event is not \'executeId\'')
        if (!event.logger) throw reject('REQUEST_FAIL', 'Event is not \'logger\'')
        if (!event.path) throw reject('REQUEST_FAIL', 'Event is not \'path\'')
        event.context.say = () => 'hello world'
    })

    world.on('milkio:executeAfter', async (event) => {
        if (!event.context) throw reject('REQUEST_FAIL', 'Event is not \'context\'')
        if (!event.executeId) throw reject('REQUEST_FAIL', 'Event is not \'executeId\'')
        if (!event.logger) throw reject('REQUEST_FAIL', 'Event is not \'logger\'')
        if (!event.path) throw reject('REQUEST_FAIL', 'Event is not \'path\'')
        if (!event.results) throw reject('REQUEST_FAIL', 'Event is not\'results\'')
        if (event.context.path === '/context') event.results.value = { success: 'success' }
    })

    world.on('milkio:httpRequest', async (event) => {
        if (!event.executeId) throw reject('REQUEST_FAIL', 'Event is not \'executeId\'')
        if (!event.logger) throw reject('REQUEST_FAIL', 'Event is not \'logger\'')
        if (!event.path) throw reject('REQUEST_FAIL', 'Event is not \'path\'')
        if (!event.http) throw reject('REQUEST_FAIL', 'Event is not \'http\'')
    })

    world.on('milkio:httpResponse', async (event) => {
        if (!event.executeId) throw reject('REQUEST_FAIL', 'Event is not \'executeId\'')
        if (!event.logger) throw reject('REQUEST_FAIL', 'Event is not \'logger\'')
        if (!event.path) throw reject('REQUEST_FAIL', 'Event is not \'path\'')
        if (!event.http) throw reject('REQUEST_FAIL', 'Event is not \'http\'')
        if (!event.context) throw reject('REQUEST_FAIL', 'Event is not \'context\'')
    })
})