import { action } from "milkio";

export default action({
  meta: {
    methods: [],
  },
  async handler(
    context,
    params: {
      a: string;
      b: number;
    },
  ): Promise<{ count: number }> {
    const count = Number(params.a) + params.b;
    context.logger.info("count", count);
    return { count };
  },
});
