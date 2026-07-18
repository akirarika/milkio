import type { MilkioContext } from "../../../.milkio/declares.ts";

type Params = { username?: string; password?: string };

type Result = { username: string; baz: string; createdAt: Date };

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
    const result: { username: string; password: string; createdAt: Date; baz: string } = {
        username: params.username ?? "administrator",
        password: params.password ?? "Pa$$w0rd!",
        baz: context.config.baz,
        createdAt: new Date(),
    };
    return result;
}