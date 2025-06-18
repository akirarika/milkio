import { join } from "node:path";

export async function denoHandler(milkioDirPath: string) {
  await Bun.write(
    join(milkioDirPath, "run.ts"),
    `#!/usr/bin/env deno
import { create } from "../index.ts";

async function bootstrap() {
  const world = await create({
    develop: Deno.env.get("COOKBOOK_DEVELOP") === "ENABLE",
  });
  Deno.serve({ port: world.listener.port }, async (request) => {
    return world.listener.fetch({
      request,
      env: Deno.env.toObject(),
      envMode: Deno.env.get("MODE") ?? "development",
    });
  });
}

void bootstrap();`,
  );
}
