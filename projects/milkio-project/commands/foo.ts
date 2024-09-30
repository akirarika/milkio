import { command } from "milkio";

export default command({
  async handler(commands, options) {
    console.log("hello world", commands, options);
  },
});
