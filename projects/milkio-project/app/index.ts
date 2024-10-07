import { reject, stream } from "milkio";

export default stream({
  async *handler(context, params) {
    for (let index = 0; index < 16; index++) {
      yield `hello ${index}`;
      await Bun.sleep(64);
    }
    console.log("超过 16次了");
    throw reject("FAIL", "超过 16次了");
  },
});
