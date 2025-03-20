import { cloneDeep } from "lodash-es";
import type { CookbookActionParams, CookbookOptions } from "../utils/cookbook-dto-types";
import { workers } from "../workers";

async function list(options: CookbookOptions, params: CookbookActionParams) {
  if (params.type !== "project@list") return false;
  const projects = cloneDeep(options.projects);

  const tasks = [];
  for (const [id, worker] of workers)
    tasks.push(
      (async () => {
        const result = await worker.testConnect();
        (projects[id] as any).state = worker.state;
        (projects[id] as any).meta = worker.meta;
        (projects[id] as any).connect = result.success;
      })(),
    );
  await Promise.all(tasks);

  return projects;
}

async function log(options: CookbookOptions, params: CookbookActionParams) {
  if (params.type !== "project@log") return false;
  const worker = workers.get(params.key);
  if (!worker) return { refresh: true };
  const firstIndex = worker.stdout.findIndex(([id]) => id >= params.firstId);
  return firstIndex === -1 ? [] : worker.stdout.slice(firstIndex, worker.stdout.length);
}

async function stop(options: CookbookOptions, params: CookbookActionParams) {
  if (params.type !== "project@stop") return false;
  const worker = workers.get(params.key);
  if (!worker) return { refresh: true };
  await worker.kill();
  return {};
}

async function start(options: CookbookOptions, params: CookbookActionParams) {
  if (params.type !== "project@start") return false;
  const worker = workers.get(params.key);
  if (!worker) return { refresh: true };
  await worker.run();
  return {};
}

export const projectActions = [list, log, stop, start];
