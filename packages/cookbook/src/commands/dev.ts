import chalk from "chalk";
import * as process from "node:process";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import { generator } from "../generator";
import { progress } from "../progress";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { selectMode } from "../utils/select-mode";

export default await defineCookbookCommand(async (utils) => {
  const options = await getCookbookToml(progress);

  const start = async (mode: string) => {
    progress.open("cookbook is generating..");
    const startTime = new Date();
    (globalThis as any).__COOKBOOK_OPTIONS__ = options;

    await generator.watcher(options, mode);

    const { startCookbookServer, useCookbookWorld } = await import("@milkio/cookbook-server");
    const { initWorkers } = await import("../workers");
    const { initWatcher } = await import("../watcher");
    await initWorkers(options, mode);
    await Promise.all([initWatcher(options, mode)]);

    const world = await useCookbookWorld();
    process.on("SIGINT", async () => {
      await world.emit("cookbook:exit", undefined);
      process.exit(0);
    });

    const endTime = new Date();
    await progress.close("Cookbook is ready.");
    console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Time taken: ") + chalk.hex("#24B56A")(`${endTime.getTime() - startTime.getTime()}ms`));
    console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Operating mode: ") + chalk.hex("#24B56A")(mode));
    console.log("");

    const server = await startCookbookServer();
    world.on("cookbook:exit", async () => await server.stop(true));
  };

  void start(await selectMode(options));

  const resolvers = Promise.withResolvers();
  await resolvers.promise; // let the never exit
});
