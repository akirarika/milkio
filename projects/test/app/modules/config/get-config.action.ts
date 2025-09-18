import { action } from "milkio";

/**
 * config
 */
export default action({
    async handler(context, params: {}): Promise<typeof context.config> {
        context.logger.info("hello world", context.config);
        return {
            ...context.config,
        };
    },
});
