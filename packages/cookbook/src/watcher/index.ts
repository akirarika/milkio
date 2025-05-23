import consola from "consola";
import { debounce } from "lodash-es";
import { watch } from "node:fs";
import { join } from "node:path";
import { exists } from "node:fs/promises";
import { emitter } from "../emitter/index.ts";
import { exit, cwd } from "node:process";
import { generator } from "../generator/index.ts";
import type { CookbookOptions } from "../utils/cookbook-dto-types.ts";
import { outputPrefix } from "../utils/output-prefix.ts";

export async function initWatcher(options: CookbookOptions) {
  let waiting: ReturnType<typeof Promise.withResolvers> = Promise.withResolvers();
  const changes = new Map<string, "rename" | "change">();
  waiting.resolve();

  const emit = debounce(async () => {
    await waiting.promise;
    waiting = Promise.withResolvers();

    consola.start(`${outputPrefix("cookbook", 0, "")}regenerating..`);
    await generator.watcher(options);
    for (const [filename, event] of changes) {
      emitter.emit("data", {
        type: "watcher@change",
        event,
        path: filename,
      });
    }

    consola.success(`${outputPrefix("cookbook", 0, "")}regenerated!`);
    waiting.resolve();
  }, 512);

  const watcherForProjects = watch(join(cwd(), "projects"), { persistent: true, recursive: true }, (event, filename) => {
    if (!filename) return;
    const f = filename.replaceAll("\\", "/");
    if (f.includes("/node_modules/")) return;
    if (f.endsWith(".test.ts")) return;
    if (f.endsWith(".spec.ts")) return;
    if (f.endsWith(".test.js")) return;
    if (f.endsWith(".spec.js")) return;
    for (const projectName in options.projects) {
      const project = options.projects[projectName];
      if (project.type !== "milkio" && f.startsWith(`${projectName}/`)) return;
      if (f.startsWith(`${projectName}/.milkio/`)) return;
    }

    changes.set(`projects/${f}`, event);
    emit();
  });

  const watcherForPackages: any | undefined = undefined;
  if (await exists(join(cwd(), "packages"))) {
    watch(join(cwd(), "packages"), { persistent: true, recursive: true }, (event, filename) => {
      if (!filename) return;
      const f = filename.replaceAll("\\", "/");
      if (f.includes("/node_modules/")) return;
      if (f.endsWith(".test.ts")) return;
      if (f.endsWith(".spec.ts")) return;
      if (f.endsWith(".test.js")) return;
      if (filename.endsWith(".spec.js")) return;
      changes.set(`packages/${f}`, event);
      emit();
    });
  }

  process.on("SIGINT", () => {
    watcherForProjects.close();
    if (watcherForPackages) watcherForPackages.close();
    exit(0);
  });
}
