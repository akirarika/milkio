import { action, reject } from "milkio";

export default action({
  async handler(context, params: { username?: string; password?: string }): Promise<{ username: string; createdAt: Date }> {
    const result: { username: string; password: string; createdAt: Date } = {
      username: params.username ?? "administrator",
      password: params.password ?? "Pa$$w0rd!",
      createdAt: new Date(),
    };
    return result;
  },
});
