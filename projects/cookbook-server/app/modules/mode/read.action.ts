import { action } from "milkio";

export default action({
    async handler(
        context,
        params: {},
    ): Promise<{ mode: string }> {
        const mode = context.config.mode;
        return { mode };
    },
});
