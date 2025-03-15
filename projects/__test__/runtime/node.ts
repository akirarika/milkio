import { createServer } from "@hattip/adapter-node";
import { create } from "..";

async function bootstrap() {
  const world = await create();

  createServer(async ({ request, env }) => {
    return world.listener.fetch({
      request,
      env,
      envMode: env("MILKIO_DEVELOP") === 'ENABLE' ? 'development' : 'production',
    })
  },
  ).listen(world.listener.port, "0.0.0.0", () => {
    console.log(`Server listening on http://localhost:${world.listener.port}`);
  });
}

void bootstrap()