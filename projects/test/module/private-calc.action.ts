import { action, reject, type $types } from "milkio";

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
