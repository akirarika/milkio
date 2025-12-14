import { join } from "node:path";
import type { CookbookOptions } from "../../utils/cookbook-dto-types";

export async function denoHandler(project: CookbookOptions["projects"]["key"], milkioDirPath: string) {
    await Bun.write(
        join(milkioDirPath, "run.ts"),
        `#!/usr/bin/env deno
import { create } from "../index.ts";

async function bootstrap() {
  const world = await create({
    port: ${project.port},
    develop: Boolean(Deno.env.get("COOKBOOK_BASE_URL")),
    fetchEnv: (key: string) => Deno.env.get(key) ?? undefined,
  });
  Deno.serve({ port: world.listener.port }, async (request) => {
    return world.listener.fetch({
      request,
      env: Deno.env.toObject(),
      envMode: Deno.env.get("COOKBOOK_MODE") ?? "test",
    });
  });
}

void bootstrap();`,
    );
}
