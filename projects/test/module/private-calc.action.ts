import { action, reject } from "milkio";
import { env } from "node:process";
import { userTable } from "./database/user.table.ts";

export default action({
  async handler(
    context,
    params: {
      a: string;
      b: number;
      throw?: boolean;
    },
  ): Promise<{ count: number }> {
    const count = Number(params.a) + params.b;
    context.logger.info("count", count);

    if (params.throw) throw reject("REQUEST_FAIL", "custom failed");

    await new Promise((resolve) => setTimeout(resolve, 500));

    return { count };
  },
});
