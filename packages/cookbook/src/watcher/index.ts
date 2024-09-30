import type { CookbookOptions } from "..";
import { debounce } from "lodash-es";
import { watch } from "node:fs";
import { join } from "node:path";
import { exists } from "fs/promises";
import { emitter } from "../emitter";
import { exit, cwd } from "node:process";
import { generator } from "../generator";
import { workers } from "../workers";
import consola from "consola";

export const initWatcher = async (options: CookbookOptions) => {
  let waiting: ReturnType<typeof Promise.withResolvers> = Promise.withResolvers();
  const changes = new Map<string, "rename" | "change">();
  void generator.insignificant(options).then(waiting.resolve);

  const emit = debounce(async () => {
    await waiting.promise;
    waiting = Promise.withResolvers();

    for (const projectName in options.projects) {
      const project = options.projects[projectName];
      if (project.type !== "milkio") continue;
      workers.get(projectName)!.kill();
    }
    await generator.significant(options);
    for (const [filename, event] of changes) {
      emitter.emit("data", {
        type: "watcher@change",
        event: event,
        path: filename,
      });
    }
    await Bun.sleep(128);
    for (const projectName in options.projects) {
      const project = options.projects[projectName];
      if (project.type !== "milkio") continue;
      consola.success(`[cookbook] ${projectName} reloading..`);
      workers.get(projectName)!.run();
    }
    await generator.insignificant(options);

    consola.success(`[cookbook] all milkio project restarts completed!`);
    waiting.resolve();
  }, 768);

  const watcherForProjects = watch(join(cwd(), "projects"), { persistent: true, recursive: true }, (event, filename) => {
    if (!filename) return;
    for (const projectName in options.projects) {
      const project = options.projects[projectName];
      if (filename.startsWith(`${projectName}/node_modules/`)) return;
      if (project.type !== "milkio" && filename.startsWith(`${projectName}/`)) return;
      if (filename.startsWith(`${projectName}/.milkio/`)) return;
    }
    changes.set(`projects/${filename}`, event);
    emit();
  });

  let watcherForPackages: any | undefined = undefined;
  if (await exists(join(cwd(), "packages"))) {
    watch(join(cwd(), "packages"), { persistent: true, recursive: true }, (event, filename) => {
      if (!filename) return;
      changes.set(`packages/${filename}`, event);
      emit();
    });
  }

  process.on("SIGINT", () => {
    watcherForProjects.close();
    if (watcherForPackages) watcherForPackages.close();
    exit(0);
  });
};
