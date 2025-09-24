import { action } from "milkio";

export default action({
    async handler(context, params: { username?: string; password?: string }): Promise<{ username: string; baz: string; createdAt: Date }> {
        const result: { username: string; password: string; createdAt: Date; baz: string } = {
            username: params.username ?? "administrator",
            password: params.password ?? "Pa$$w0rd!",
            baz: context.config.baz,
            createdAt: new Date(),
        };
        return result;
    },
});
