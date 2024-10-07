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
import { fetchWithTimeout } from "../utils/fetch-with-timeout";

export const initWatcher = async (options: CookbookOptions) => {
  let waiting: ReturnType<typeof Promise.withResolvers> = Promise.withResolvers();
  const changes = new Map<string, "rename" | "change">();
  void generator.insignificant(options).then(waiting.resolve);

  const emit = debounce(async () => {
    await waiting.promise;
    waiting = Promise.withResolvers();

    for (const projectName in options.projects) {
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
    await Promise.all([
      // UwU
      generator.insignificant(options),
      (async () => {
        // Wait for all milkio projects to start and can be accessed
        await Promise.all([
          ...(() => {
            const projectStatus = new Map<string, { promise: Promise<undefined>; resolve: (value?: undefined | PromiseLike<undefined>) => void; reject: (reason?: any) => void }>();
            for (const projectName in options.projects) {
              const project = options.projects[projectName];
              if (project.type !== "milkio") continue;
              projectStatus.set(projectName, Promise.withResolvers());
              let counter = 256;
              let timer: Timer | null = setInterval(async () => {
                if (--counter <= 0) {
                  clearInterval(timer!);
                  timer = null;
                  consola.warn(`[cookbook] Your project ${projectName} (http://localhost:${project.port}/) HTTP server hasn't started for too long.`);
                  projectStatus.get(projectName)!.resolve(undefined);
                  return;
                }
                try {
                  const response = await fetchWithTimeout(`http://localhost:${project.port}/generate_204`, { method: "HEAD", timeout: 1024 });
                  if (response.status === 204) {
                    if (timer) clearTimeout(timer);
                    timer = null;
                    return projectStatus.get(projectName)!.resolve(undefined);
                  }
                } catch (error) {}
              }, 42);
            }
            return Array.from(projectStatus.values()).map((v) => v.promise);
          })(),
        ]);
        // restart the remaining non-milkio projects
        // The reason to make sure that milkio projects are started before starting them is because these projects are usually web projects, and if the backend is not running, there will be an error when starting
        for (const projectName in options.projects) {
          const project = options.projects[projectName];
          if (project.type === "milkio") continue;
          consola.success(`[cookbook] ${projectName} reloading..`);
          workers.get(projectName)!.run();
        }
      })(),
    ]);

    consola.success(`[cookbook] all project restarts completed!`);
    waiting.resolve();
  }, 300);

  const watcherForProjects = watch(join(cwd(), "projects"), { persistent: true, recursive: true }, (event, filename) => {
    if (!filename) return;
    filename = filename.replaceAll("\\", "/");
    if (filename.includes(`/node_modules/`)) return;
    if (filename.endsWith(`.test.ts`)) return;
    if (filename.endsWith(`.spec.ts`)) return;
    if (filename.endsWith(`.test.js`)) return;
    if (filename.endsWith(`.spec.js`)) return;
    for (const projectName in options.projects) {
      const project = options.projects[projectName];
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
      filename = filename.replaceAll("\\", "/");
      if (filename.includes(`/node_modules/`)) return;
      if (filename.endsWith(`.test.ts`)) return;
      if (filename.endsWith(`.spec.ts`)) return;
      if (filename.endsWith(`.test.js`)) return;
      if (filename.endsWith(`.spec.js`)) return;
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
