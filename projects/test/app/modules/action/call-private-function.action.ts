import { action, type MilkioContext, type MilkioMeta } from "milkio";

const meta: MilkioMeta = {
    methods: ["POST"],
}

async function handler(context: MilkioContext, params: { username?: string; password?: string }): Promise<{ username: string; baz: string; createdAt: Date }> {
    const result = await context.call(import("./type-safety.action.ts"), { ...params });

    return result;
}

export default action({ meta, handler });
