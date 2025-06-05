import { join } from "node:path";
import { exists, writeFile } from "node:fs/promises";

export async function bunHandler(paths: { milkio: string }) {
  await writeFile(
    join(paths.milkio, "run.ts"),
    `#!/usr/bin/env bun
import { create } from "../index.ts";
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
        envMode: env.MODE ?? "development",
      });
    },
  });
}

void bootstrap();`,
  );
}
