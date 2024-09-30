import { action, reject } from "milkio";

export default action({
  async handler(
    context,
    params: {
      hello: string;
      world: string;
    },
  ) {
    return "hello world";
  },
});
