import { create } from '..'
import { env } from 'bun'

async function bootstrap() {
  const world = await create()
  Bun.serve({
    port: world.listener.port,
    async fetch(request) {
      return world.listener.fetch({
        request,
        env,
        envMode: env.MILKIO_DEVELOP === 'ENABLE' ? 'development' : 'production',
      })
    },
  })

  let i = 0
  console.log('hello world');
  setInterval(() => {
    console.log('hello world'+ ++i);
  }, 2333)
  
}

void bootstrap()
