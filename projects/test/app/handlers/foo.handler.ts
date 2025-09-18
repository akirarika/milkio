import { handler, reject } from 'milkio'

export default handler((world) => {
    world.on('milkio:executeBefore', async (event) => {
        if (!event.context) throw reject('FAIL', 'Event is not \'context\'')
        if (!event.executeId) throw reject('FAIL', 'Event is not \'executeId\'')
        if (!event.logger) throw reject('FAIL', 'Event is not \'logger\'')
        if (!event.path) throw reject('FAIL', 'Event is not \'path\'')
        event.context.say = () => 'hello world'
    })

    world.on('milkio:executeAfter', async (event) => {
        if (!event.context) throw reject('FAIL', 'Event is not \'context\'')
        if (!event.executeId) throw reject('FAIL', 'Event is not \'executeId\'')
        if (!event.logger) throw reject('FAIL', 'Event is not \'logger\'')
        if (!event.path) throw reject('FAIL', 'Event is not \'path\'')
        if (!event.results) throw reject('FAIL', 'Event is not\'results\'')
        if (event.context.path === '/context') event.results.value = { success: 'success' }
    })

    world.on('milkio:httpRequest', async (event) => {
        if (!event.executeId) throw reject('FAIL', 'Event is not \'executeId\'')
        if (!event.logger) throw reject('FAIL', 'Event is not \'logger\'')
        if (!event.path) throw reject('FAIL', 'Event is not \'path\'')
        if (!event.http) throw reject('FAIL', 'Event is not \'http\'')
    })

    world.on('milkio:httpResponse', async (event) => {
        if (!event.executeId) throw reject('FAIL', 'Event is not \'executeId\'')
        if (!event.logger) throw reject('FAIL', 'Event is not \'logger\'')
        if (!event.path) throw reject('FAIL', 'Event is not \'path\'')
        if (!event.http) throw reject('FAIL', 'Event is not \'http\'')
        if (!event.context) throw reject('FAIL', 'Event is not \'context\'')
    })
})