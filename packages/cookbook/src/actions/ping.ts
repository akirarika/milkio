import type { CookbookActionParams } from "../utils/cookbook-dto-types"

export async function actionPing(params: CookbookActionParams) {
    if (params.type !== 'milkio@ping') return false
    return 'pong'
}
