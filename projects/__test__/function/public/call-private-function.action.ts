import { action } from "milkio";

export default action({
  async handler(
    context,
    params: {
      a: string;
      b: number;
      throw?: boolean;
    },
  ): Promise<{ count: number }> {
    const result = await context.call(import("../private/private-calc.action"), {
      a: params.a,
      b: params.b,
      throw: params.throw,
    });

    return result;
  },
});
