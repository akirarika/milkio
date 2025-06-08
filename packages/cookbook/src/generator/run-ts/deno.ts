import { join } from "node:path";
import { exists, writeFile } from "node:fs/promises";

export async function denoHandler(paths: { milkio: string }) {
  await writeFile(
    join(paths.milkio, "run.ts"),
    `#!/usr/bin/env deno
import { create } from "../index.ts";

async function bootstrap() {
  const world = await create({
    develop: Deno.env.get("COOKBOOK_DEVELOP") === "ENABLE",
    argv: process.argv,
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
