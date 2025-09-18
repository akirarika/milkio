import chalk from "chalk";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import { progress } from "../progress";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { join } from "node:path";
import consola from "consola";
import { cwd, exit } from "node:process";
import { calcHash } from "../utils/calc-hash";
import { getRandomPort } from "../utils/get-random-port";
import { exists, readFile, writeFile } from "node:fs/promises";
import { execScript } from "../utils/exec-script";

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

    const packageJson = (await exists(join(cwd(), "package.json"))) ? JSON.parse(await readFile(join(cwd(), "package.json"), "utf-8")) : undefined;
    if (!packageJson?.scripts?.test) {
        consola.error(`The "test" script is not defined in the "package.json" file, try add it.`);
        exit(1);
    }

    if (!packageJson?.devDependencies?.vitest && !packageJson?.dependencies?.vitest) {
        consola.error(`The "vitest" package is not defined in the "package.json" file, try run:\n${options.general.packageManager} i vitest`);
        exit(1);
    }

    const start = async (mode: string) => {
        (globalThis as any).__COOKBOOK_OPTIONS__ = options;

        progress.open("cookbook is starting..");
        const startTime = new Date();
        const { initWatcher } = await import("../watcher");
        await initWatcher(options, mode, true);

        const cookbookServerAccessKey = `c${await calcHash(crypto.randomUUID())}`;

        const cookbookServerPort = await getRandomPort();
        const cookbookServerBaseUrl = `http://localhost:${cookbookServerPort}/${cookbookServerAccessKey}`;
        await writeFile(join(cwd(), "node_modules", ".cookbook"), cookbookServerBaseUrl);

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

    await start("test");

    const exitcode = await execScript(`${options.general.packageManager} run test`, { cwd: cwd() });

    if (exitcode !== 0) {
        consola.error(`Test command failed with exit code ${exitcode}.`);
        exit(exitcode);
    }

    await writeFile(join(cwd(), "node_modules", ".cookbook__success-time-of-test-run"), `${Date.now()}`);

    consola.info("The timestamp of the completed test run has been written to \"/node_modules/.cookbook__success-time-of-test-run\". If you need to avoid re-running the tests in the CI step, you can refer to the time in this file.\n");

    consola.success("Test command completed!");
});
