import { action, reject } from "milkio";

export default action({
  async handler(context, params: {}): Promise<{ username: string }> {
    const result: { username: string; password: string } = {
      username: "administrator",
      password: "Pa$$w0rd!",
    };
    return result;
  },
});
