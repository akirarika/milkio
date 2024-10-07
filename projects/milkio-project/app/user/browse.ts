import { action, reject } from "milkio";

export default action({
  async handler(context, params: {}) {
    throw reject("FAIL", "adsadsasd");
    return "hello world";
  },
});
