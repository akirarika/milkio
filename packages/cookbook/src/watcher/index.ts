import consola from "consola";
import { debounce } from "lodash-es";
import { watch } from "node:fs";
import { join } from "node:path";
import { exists } from "node:fs/promises";
import { emitter } from "../emitter/index.ts";
import { exit, cwd } from "node:process";
import { generator } from "../generator/index.ts";
import { workers } from "../workers/index.ts";
import type { CookbookOptions } from "../utils/cookbook-dto-types.ts";

export async function initWatcher(options: CookbookOptions) {
  let waiting: ReturnType<typeof Promise.withResolvers> = Promise.withResolvers();
  const changes = new Map<string, "rename" | "change">();
  void generator.insignificant(options).then(waiting.resolve);

  const emit = debounce(async () => {
    await waiting.promise;
    waiting = Promise.withResolvers();

    for (const projectName in options.projects) {
      const project = options.projects[projectName];
      if (project?.watch) {
        await workers.get(projectName)!.kill();
      }
    }

    consola.success("[cookbook] regenerating..");
    await generator.significant(options);
    for (const [filename, event] of changes) {
      emitter.emit("data", {
        type: "watcher@change",
        event,
        path: filename,
      });
    }
    await Bun.sleep(128);
    for (const projectName in options.projects) {
      const project = options.projects[projectName];
      if (project?.watch) {
        consola.success(`[cookbook] ${projectName} reloading..`);
        workers.get(projectName)!.run();
      }
    }
    void generator.insignificant(options);

    consola.success("[cookbook] regenerated!");
    waiting.resolve();
  }, 300);

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
