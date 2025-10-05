// oxlint-disable-next-line no-unused-vars

import type { MilkioContext } from "../../../.milkio/declares.ts";

export async function handler(context: MilkioContext, params: {}): Promise<{ success: string }> {
    if (!context.executeId) throw context.reject("REQUEST_FAIL", "Context is not 'executeId'");
    if (!context.http) throw context.reject("REQUEST_FAIL", "Context is not 'http'");
    if (!context.logger) throw context.reject("REQUEST_FAIL", "Context is not 'logger'");
    if (!context.path) throw context.reject("REQUEST_FAIL", "Context is not 'path'");
    return {
        success: "success",
    };
}