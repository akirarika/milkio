import * as http from "node:http";
import { createRequestListener } from "@mjackson/node-fetch-server";
import { create } from "../index.ts";
import { env } from "node:process";

async function bootstrap() {
  const world = await create({
    develop: env.MILKIO_DEVELOP === "ENABLE",
    argv: process.argv,
  });

  function handler(request: Request) {
    return world.listener.fetch({
      request,
      env,
      envMode: env.MILKIO_DEVELOP === "ENABLE" ? "development" : "production",
    });
  }

  const server = http.createServer(createRequestListener(handler));
  server.listen(world.listener.port);
}

void bootstrap();
