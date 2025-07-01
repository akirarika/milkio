import { action } from "milkio";

export default action({
  async handler(context, params: { username?: string; password?: string }): Promise<{ username: string; createdAt: Date }> {
    const result = await context.call(import("./type-safety.action.ts"), { ...params });

    return result;
  },
});
