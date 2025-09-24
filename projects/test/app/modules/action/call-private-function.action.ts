import { action, type $context, type $meta } from "milkio";

const meta: $meta = {
    methods: ["POST"],
}

async function handler(context: $context, params: { username?: string; password?: string }): Promise<{ username: string; baz: string; createdAt: Date }> {
    const result = await context.call(import("./type-safety.action.ts"), { ...params });

    return result;
}

export default action({ meta, handler });
