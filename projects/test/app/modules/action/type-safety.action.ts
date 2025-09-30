import type { MilkioContext } from "../../../.milkio/declares.ts";

export async function handler(context: MilkioContext, params: { username?: string; password?: string }): Promise<{ username: string; baz: string; createdAt: Date }> {
    const result: { username: string; password: string; createdAt: Date; baz: string } = {
        username: params.username ?? "administrator",
        password: params.password ?? "Pa$$w0rd!",
        baz: context.config.baz,
        createdAt: new Date(),
    };
    return result;
}