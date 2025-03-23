import { defineCookbookCommand } from "@milkio/cookbook-command";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { generator } from "../generator";
import consola from "consola";

export default await defineCookbookCommand(async (utils) => {
  consola.start("Cookbook generating..");
  const options = await getCookbookToml();
  await generator.significant(options);
  await generator.insignificant(options);
  consola.success("Cookbook generated!");
});
