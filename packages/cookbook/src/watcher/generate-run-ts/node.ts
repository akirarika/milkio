import { join } from "node:path";

export async function nodeHandler(milkioDirPath: string) {
  await Bun.write(
    join(milkioDirPath, "run.ts"),
    `#!/usr/bin/env node
import * as http from "node:http";
import { createRequestListener } from "@mjackson/node-fetch-server";
import { create } from "../index.ts";
import { env } from "node:process";

async function bootstrap() {
  const world = await create({
    develop: env.COOKBOOK_DEVELOP === "ENABLE",
  });

  function handler(request: Request) {
    return world.listener.fetch({
      request,
      env,
      envMode: env.MODE ?? "development",
    });
  }

  const server = http.createServer(createRequestListener(handler));
  server.listen(world.listener.port);
}

void bootstrap();`,
  );
}
