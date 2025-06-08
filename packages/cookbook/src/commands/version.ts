import { defineCookbookCommand } from "@milkio/cookbook-command";
import packageJson from "../../package.json" with { type: "json" };

export default await defineCookbookCommand(async (utils) => {
  console.log(packageJson.version);
});
