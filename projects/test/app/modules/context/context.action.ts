import { reject } from "milkio";
import type { MilkioContext } from "../../../.milkio/declares.ts";

export async function handler(context: MilkioContext, params: {}): Promise<{ success: string }> {
    if (!context.executeId) throw reject("REQUEST_FAIL", "Context is not 'executeId'");
    if (!context.http) throw reject("REQUEST_FAIL", "Context is not 'http'");
    if (!context.logger) throw reject("REQUEST_FAIL", "Context is not 'logger'");
    if (!context.path) throw reject("REQUEST_FAIL", "Context is not 'path'");
    return {
        success: "success",
    };
}