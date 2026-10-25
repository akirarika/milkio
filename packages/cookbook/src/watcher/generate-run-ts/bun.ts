import { writeFileEnsured } from "../../utils/node-compat";
import { join } from "node:path";
import type { CookbookOptions } from "../../utils/cookbook-dto-types.ts";

// NOTE: the template below is generated code for projects whose cookbook.toml
// declares `runtime = "bun"`. It intentionally keeps Bun APIs (Bun.serve and
// the "bun" env import) because it runs on the Bun runtime, not on the CLI.
export async function bunHandler(project: CookbookOptions["projects"]["key"], milkioDirPath: string) {
    await writeFileEnsured(
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
    maxRequestBodySize: world.listener.bodyLimit,
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
