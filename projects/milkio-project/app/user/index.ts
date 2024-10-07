import { action, reject } from "milkio";

export default action({
  async handler(
    context,
    params: {
      hello: string;
      world: string;
    },
  ) {
    context.logger.info("这段代码运行在 Milkio Server 中，是使用 Bun 运行到", params);
    return "hello world";
  },
});
