import { create } from "..";
import { env } from "bun";

async function bootstrap() {
  const world = await create({
    develop: env.MILKIO_DEVELOP === "ENABLE",
    argv: process.argv,
  });
  Bun.serve({
    port: world.listener.port,
    async fetch(request) {
      return world.listener.fetch({
        request,
        env,
        envMode: env.MILKIO_DEVELOP === "ENABLE" ? "development" : "production",
      });
    },
  });
}

void bootstrap();
