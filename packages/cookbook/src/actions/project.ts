import { cloneDeep } from "lodash-es"
import type { CookbookActionParams, CookbookOptions } from "../utils/cookbook-dto-types"
import { workers } from "../workers"

async function list(options: CookbookOptions, params: CookbookActionParams) {
    if (params.type !== 'project@list') return false
    const projects = cloneDeep(options.projects)

    const tasks = [];
    for (const [id, worker] of workers) tasks.push((async () => {
        const result = await worker.testConnect();
        (projects[id] as any).state = worker.state;
        (projects[id] as any).connect = result.success;
    })())
    await Promise.all(tasks);

    return projects
}

async function log(options: CookbookOptions, params: CookbookActionParams) {
    if (params.type !== 'project@log') return false
    const worker = workers.get(params.key)
    if (!worker) return false
    const firstIndex = worker.stdout.findIndex(([timestamp]) => timestamp >= params.firstId)
    return worker.stdout.slice(firstIndex === -1 ? 0 : firstIndex, worker.stdout.length - 1)
}

export const projectActions = [
    list,
    log,
]