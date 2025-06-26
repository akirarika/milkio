import { action, reject } from "milkio";

export default action({
  async handler(context, params: {}): Promise<{ username: string; createdAt: Date }> {
    const result: { username: string; password: string; createdAt: Date } = {
      username: "administrator",
      password: "Pa$$w0rd!",
      createdAt: new Date(),
    };
    return result;
  },
});
