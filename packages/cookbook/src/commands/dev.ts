import chalk from "chalk";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import { progress } from "../progress";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { selectMode } from "../utils/select-mode";
import { join } from "node:path";
import consola from "consola";
import { cwd, exit } from "node:process";
import { calcHash } from "../utils/calc-hash";
import { getRandomPort } from "../utils/get-random-port";
import { exists, readFile, writeFile } from "node:fs/promises";

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
        (globalThis as any).__COOKBOOK_OPTIONS__ = options;

        progress.open("cookbook is starting..");
        const startTime = new Date();
        const { initWatcher } = await import("../watcher");
        await initWatcher(options, mode, true);

        const cookbookServerAccessKey = `c${await calcHash(crypto.randomUUID())}`;

        let cookbookServerPort;
        let cookbookServerBaseUrl;
        if (await exists(join(cwd(), ".cookbook"))) {
            cookbookServerBaseUrl = (await readFile(join(cwd(), ".cookbook"))).toString().trim();
            cookbookServerPort = Number(new URL(cookbookServerBaseUrl).port);
        } else {
            cookbookServerPort = await getRandomPort();
            cookbookServerBaseUrl = `http://localhost:${cookbookServerPort}/${cookbookServerAccessKey}`;
            await writeFile(join(cwd(), ".cookbook"), cookbookServerBaseUrl);
        }

        const { startCookbookServer } = await import("@milkio/cookbook-server");
        const _server = await startCookbookServer({ port: cookbookServerPort, accessKey: cookbookServerAccessKey });

        const { initWorkers } = await import("../workers");
        await initWorkers(options, mode, cookbookServerBaseUrl);

        const endTime = new Date();
        const time = Math.max(endTime.getTime() - startTime.getTime(), 0);
        await progress.close(chalk.gray("cookbook is ready."));
        console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Time taken: ") + chalk.hex("#24B56A")(`${time}ms`) + (time > 8192 ? chalk.gray(" (✨ cached! next start faster)") : ""));
        console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Current mode: ") + chalk.hex("#24B56A")(mode));
        console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Current mode: ") + chalk.hex("#24B56A")(mode));

        console.log(chalk.hex("#24B56A")("△ ") + chalk.hex("#E6E7E9")("Base URL: ") + chalk.hex("#24B56A")(cookbookServerBaseUrl));

        console.log("");
    };

    const params = utils.getParams();
    void start(await selectMode(options, params));

    const resolvers = Promise.withResolvers();
    await resolvers.promise; // let the never exit
});
