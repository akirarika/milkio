import type { CookbookActionParams } from "../utils/cookbook-dto-types";
import { workers } from "../workers";

export async function actionWorkersList(params: CookbookActionParams) {
    if (params.type !== 'workers@list') return false
    const result: Record<string, any> = {}
    const keys = [...workers.keys()]
    for (const key of keys) {
        const worker = workers.get(key)
        result[key] = {
            key: key,
            state: worker?.state ?? 'stopped',
        }
    }
    return result
}
