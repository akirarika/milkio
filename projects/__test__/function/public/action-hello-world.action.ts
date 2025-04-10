import { action, reject, typeSafety } from "milkio";

export default action({
  meta: {
    typeSafety: false,
  },
  async handler(
    context,
    params: {
      a: string;
      b: number;
      throw?: boolean;
    },
  ): Promise<{ count: number }> {
    const results = {
      count: 2 + params.b,
      say: "hello world",
    };
    if (params.throw) throw reject("FAIL", "Reject this request");

    return typeSafety(results).type<{ count: number }>();
  },
});
