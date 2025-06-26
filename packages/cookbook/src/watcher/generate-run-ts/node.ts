import { join } from "node:path";
import type { CookbookOptions } from "../../utils/cookbook-dto-types";

export async function nodeHandler(project: CookbookOptions["projects"]["key"], milkioDirPath: string) {
  await Bun.write(
    join(milkioDirPath, "run.ts"),
    `#!/usr/bin/env node
import * as http from "node:http";
import { createRequestListener } from "@mjackson/node-fetch-server";
import { create } from "../index.ts";
import { env } from "node:process";

async function bootstrap() {
  const world = await create({
    port: ${project.port},
    develop: Boolean(env.COOKBOOK_BASE_URL),
    fetchEnv: (key: string) => env[key] ?? undefined,
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
