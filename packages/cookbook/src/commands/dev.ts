import chalk from "chalk";
import * as process from "node:process";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import { progress } from "../progress";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { selectMode } from "../utils/select-mode";
import { join } from "node:path";
import consola from "consola";
import { cwd, exit } from "node:process";
import { calcHash } from "../utils/calc-hash";

export default await defineCookbookCommand(async (utils) => {
  const cookbookToml = Bun.file(join(cwd(), "cookbook.toml"));
  if (!(await cookbookToml.exists())) {
    consola.error(`The "cookbook.toml" file does not exist in the current directory: ${join(cwd())}`);
    exit(0);
  }
  const cookbookTomlText = await cookbookToml.text();
  const cookbookTomlHash = calcHash(cookbookTomlText);
  const options = await getCookbookToml(cookbookTomlText, progress);
  options.hash = cookbookTomlHash;

  const start = async (mode: string) => {
    const startTime = new Date();
    (globalThis as any).__COOKBOOK_OPTIONS__ = options;

    progress.open("cookbook is starting..");
    const { initWatcher } = await import("../watcher");
    await initWatcher(options, mode, true);
    const { initWorkers } = await import("../workers");
    await initWorkers(options, mode);

    const { startCookbookServer, useCookbookWorld } = await import("@milkio/cookbook-server");
    const world = await useCookbookWorld();
    process.on("SIGINT", async () => {
      await world.emit("cookbook:exit", undefined);
      process.exit(0);
    });

    const endTime = new Date();
    await progress.close(chalk.gray("cookbook is ready."));
    console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Time taken: ") + chalk.hex("#24B56A")(`${endTime.getTime() - startTime.getTime()}ms`));
    console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Operating mode: ") + chalk.hex("#24B56A")(mode));
    console.log("");

    const server = await startCookbookServer();
    world.on("cookbook:exit", async () => await server.stop(true));
  };

  let mode: string;
  const params = utils.getParams();
  if (params.subCommand) mode = params.subCommand;
  else mode = await selectMode(options);
  void start(mode);

  const resolvers = Promise.withResolvers();
  await resolvers.promise; // let the never exit
});
