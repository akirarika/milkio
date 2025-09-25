import { reject, type MilkioContext } from "milkio";


export async function handler(context: MilkioContext, params: {}): Promise<{ success: string }> {
    if (!context.executeId) throw reject("FAIL", "Context is not 'executeId'");
    if (!context.http) throw reject("FAIL", "Context is not 'http'");
    if (!context.logger) throw reject("FAIL", "Context is not 'logger'");
    if (!context.path) throw reject("FAIL", "Context is not 'path'");
    return {
        success: "success",
    };
}