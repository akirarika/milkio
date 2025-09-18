import { action, reject } from "milkio";

export default action({
    async handler(context, params: {}): Promise<{ success: string }> {
        if (!context.executeId) throw reject("FAIL", "Context is not 'executeId'");
        if (!context.http) throw reject("FAIL", "Context is not 'http'");
        if (!context.logger) throw reject("FAIL", "Context is not 'logger'");
        if (!context.path) throw reject("FAIL", "Context is not 'path'");
        if (context.say() !== "hello world") throw reject("FAIL", "Context is not 'say'");

        return {
            success: "success",
        };
    },
});
