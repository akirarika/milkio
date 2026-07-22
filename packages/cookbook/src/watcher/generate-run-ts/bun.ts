import { join } from "node:path";
import type { CookbookOptions } from "../../utils/cookbook-dto-types.ts";

export async function bunHandler(project: CookbookOptions["projects"]["key"], milkioDirPath: string) {
    await Bun.write(
        join(milkioDirPath, "run.ts"),
        `#!/usr/bin/env bun
// @ts-nocheck
import { create } from "../index.ts";
import { env } from "bun";

async function bootstrap() {
  const world = await create({
    port: ${project.port},
    develop: Boolean(env.COOKBOOK_BASE_URL),
    fetchEnv: (key: string) => env[key] ?? undefined,
  });
  Bun.serve({
    port: world.listener.port,
    async fetch(request) {
      return world.listener.fetch({
        request,
        env,
        envMode: env.VITE_MODE ?? "test",
      });
    },
  });
}

void bootstrap();`,
    );
}
