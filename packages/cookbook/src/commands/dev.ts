import chalk from "chalk";
import * as process from "node:process";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import { initWorkers } from "../workers";
import { initWatcher } from "../watcher";
import { initServer } from "../server";
import { generator } from "../generator";
import { progress } from "../progress";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { selectMode } from "../utils/select-mode";
import { eventManager } from "../event";

export default await defineCookbookCommand(async (utils) => {
  process.on("SIGINT", async () => {
    await eventManager.emit("exit", undefined);
    process.exit(0);
  });
  const options = await getCookbookToml(progress);

  const start = async (mode: string) => {
    progress.open("cookbook is generating..");
    const startTime = new Date();
    (globalThis as any).__COOKBOOK_OPTIONS__ = options;

    await generator.watcher(options, mode);
    await initWorkers(options, mode);
    await Promise.all([initWatcher(options, mode)]);

    void initServer(options);

    const endTime = new Date();
    await progress.close("Cookbook is ready.");
    console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Time taken: ") + chalk.hex("#24B56A")(`${endTime.getTime() - startTime.getTime()}ms`));
    console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Operating mode: ") + chalk.hex("#24B56A")(mode));
    console.log("");
  };

  void start(await selectMode(options));

  const resolvers = Promise.withResolvers();
  await resolvers.promise; // let the never exit
});
