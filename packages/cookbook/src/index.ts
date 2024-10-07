import chalk from "chalk";
import { join } from "node:path";
import { exit, cwd } from "node:process";
import { getOptions } from "./typia/generated";
import { initWorkers } from "./workers";
import { initWatcher } from "./watcher";
import { initServer } from "./server";
import { generator } from "./generator";
import consola from "consola";

export type CookbookOptions = {
  projects: Record<
    string,
    {
      type: "milkio" | "other";
      port: number;
      start: Array<string>;
      build: Array<string>;
      lazyRoutes?: boolean;
      typiaMode?: "generation" | "bundler";
      significant?: Array<string>;
      insignificant?: Array<string>;
    }
  >;
  general: {
    cookbookPort: number;
  };
};

export const execute = async () => {
  switch (process.argv[2]) {
    default: {
      console.log(asciis().join("\n"));
      console.log(chalk.hex("#0B346E")(`₋₋₋₋₋₋₋₋`));

      const startTime = new Date();
      const options: CookbookOptions = await getOptions(Bun.file(join(cwd(), "cookbook.toml")));
      if (Object.keys(options.projects).length === 0) {
        consola.error(`For at least one project, check your "cookbook.toml".`);
        exit(0);
      }
      for (const projectName in options.projects) {
        const project = options.projects[projectName];
        const packageJsonRaw = await Bun.file(join(cwd(), "projects", projectName, "package.json"));
        const packageJson = await packageJsonRaw.json();
        if (project.type === "milkio" && packageJson.dependencies?.["milkio"] === undefined) {
          consola.error(`Project "${projectName}" does not have "milkio" in its dependencies. If this not a milkio project, modify the type in "cookbook.toml" to change it from "milkio" to "other".`);
          exit(0);
        }
      }

      await generator.significant(options); // insignificant running in initWather
      await initWorkers(options);
      await Promise.all([
        // UwU
        initWatcher(options),
      ]);
      await initServer(options);

      const endTime = new Date();

      console.log(chalk.hex("#24B56A")(`△ `) + message());
      console.log(chalk.hex("#24B56A")(`△ `) + chalk.hex("#E6E7E9")(`Time taken: `) + chalk.hex("#24B56A")(`${endTime.getTime() - startTime.getTime()}ms`));
      console.log("");
      console.log(chalk.hex("#24B56A")(`△ `) + chalk.hex("#24B56A")(`cookbook:\t\t`) + chalk.hex("#4988fc")(`http://localhost:${options.general.cookbookPort}/`));
      for (const projectName in options.projects) {
        const project = options.projects[projectName];
        console.log(chalk.hex("#24B56A")(`△ `) + chalk.hex("#24B56A")(`${projectName}:\t${projectName.length > 12 ? "" : "\t"}${projectName.length > 6 ? "" : "\t"}`) + chalk.hex("#4988fc")(`http://localhost:${project.port}/`));
      }
      console.log(chalk.hex("#0B346E")(`₋₋₋₋₋₋₋₋`));
      console.log("The logger is ready for recording.");
      break;
    }

    case "build": {
      const startTime = new Date();
      const options: CookbookOptions = await getOptions(Bun.file(join(cwd(), "cookbook.toml")));

      await generator.significant(options);
      await generator.insignificant(options);

      // await new Promise((resolve, reject) => {
      //   Bun.spawn(options.commands.build, {
      //     cwd: cwd(),
      //     stdin: "inherit",
      //     stdout: "inherit",
      //     onExit: (proc, code, signalCode, error) => {
      //       if (code !== 0) reject({ proc, code, signalCode, error });
      //       else resolve({ proc, code, signalCode, error });
      //     },
      //   });
      // });

      const endTime = new Date();
      console.log("");
      console.log(`△ Milkio build completed!`);
      console.log(`△ Time taken: ${endTime.getTime() - startTime.getTime()}ms`);
      console.log("");

      break;
    }
  }
};

const asciis = () => [
  " " + " " + chalk.hex("00AEF1")(`_`) + chalk.hex("00AEE4")(`_`) + " " + " " + chalk.hex("00AED6")(`_`) + chalk.hex("00AEC9")(`_`) + " " + chalk.hex("00AEBB")(`_`) + " " + chalk.hex("00AEAE")(`_`) + " " + chalk.hex("00AEA1")(`_`) + " " + " " + " " + " " + chalk.hex("00AE93")(`_`),
  " " +
    chalk.hex("00AEF4")(`|`) +
    " " +
    " " +
    chalk.hex("00AEE9")(`\\`) +
    chalk.hex("00AEDF")(`/`) +
    " " +
    " " +
    chalk.hex("00AED4")(`(`) +
    chalk.hex("00AEC9")(`_`) +
    chalk.hex("00AEBF")(`)`) +
    " " +
    chalk.hex("00AEB4")(`|`) +
    " " +
    chalk.hex("00AEAA")(`|`) +
    " " +
    chalk.hex("00AE9F")(`_`) +
    chalk.hex("00AE94")(`(`) +
    chalk.hex("00AE8A")(`_`) +
    chalk.hex("00AE7F")(`)`) +
    " " +
    chalk.hex("00AE74")(`_`) +
    chalk.hex("00AE6A")(`_`) +
    chalk.hex("00AE5F")(`_`),
  " " +
    chalk.hex("00AEF4")(`|`) +
    " " +
    chalk.hex("00AEEA")(`|`) +
    chalk.hex("00AEE0")(`\\`) +
    chalk.hex("00AED6")(`/`) +
    chalk.hex("00AECC")(`|`) +
    " " +
    chalk.hex("00AEC1")(`|`) +
    " " +
    chalk.hex("00AEB7")(`|`) +
    " " +
    chalk.hex("00AEAD")(`|`) +
    " " +
    chalk.hex("00AEA3")(`|`) +
    chalk.hex("00AE99")(`/`) +
    " " +
    chalk.hex("00AE8E")(`/`) +
    " " +
    chalk.hex("00AE84")(`|`) +
    chalk.hex("00AE7A")(`/`) +
    " " +
    chalk.hex("00AE70")(`_`) +
    " " +
    chalk.hex("00AE66")(`\\`),
  " " +
    chalk.hex("00AEF5")(`|`) +
    " " +
    chalk.hex("00AEEB")(`|`) +
    " " +
    " " +
    chalk.hex("00AEE1")(`|`) +
    " " +
    chalk.hex("00AED7")(`|`) +
    " " +
    chalk.hex("00AECD")(`|`) +
    " " +
    chalk.hex("00AEC4")(`|`) +
    " " +
    " " +
    " " +
    chalk.hex("00AEBA")(`<`) +
    chalk.hex("00AEB0")(`|`) +
    " " +
    chalk.hex("00AEA6")(`|`) +
    " " +
    chalk.hex("00AE9C")(`(`) +
    chalk.hex("00AE93")(`_`) +
    chalk.hex("00AE89")(`)`) +
    chalk.hex("00AE1E")(`丨`),
  " " +
    chalk.hex("00AEF4")(`|`) +
    chalk.hex("00AEEA")(`_`) +
    chalk.hex("00AEE0")(`|`) +
    " " +
    " " +
    chalk.hex("00AED6")(`|`) +
    chalk.hex("00AECC")(`_`) +
    chalk.hex("00AEC1")(`|`) +
    chalk.hex("00AEB7")(`_`) +
    chalk.hex("00AEAD")(`|`) +
    chalk.hex("00AEA3")(`_`) +
    chalk.hex("00AE99")(`|`) +
    chalk.hex("00AE8E")(`_`) +
    chalk.hex("00AE84")(`|`) +
    chalk.hex("00AE7A")(`\\`) +
    chalk.hex("00AE70")(`_`) +
    chalk.hex("00AE66")(`\\`) +
    chalk.hex("00AE5B")(`_`) +
    chalk.hex("00AEA6")(`|`) +
    chalk.hex("00AE47")(`\\`) +
    chalk.hex("00AE3D")(`_`) +
    chalk.hex("00AE33")(`_`) +
    chalk.hex("00AE28")(`_`) +
    chalk.hex("00AE1E")(`/`),
];

const message = () =>
  chalk.hex("#00AEF5")("I ") +
  chalk.hex("#00AEEC")("w") +
  chalk.hex("#00AEE3")("i") +
  chalk.hex("#00AEDA")("l") +
  chalk.hex("#00AED1")("l ") +
  chalk.hex("#00AEC8")("b") +
  chalk.hex("#00AEBF")("e ") +
  chalk.hex("#00AEB6")("t") +
  chalk.hex("#00AEAD")("h") +
  chalk.hex("#00AEA3")("e ") +
  chalk.hex("#00AE9A")("b") +
  chalk.hex("#00AE91")("e") +
  chalk.hex("#00AE88")("s") +
  chalk.hex("#00AE7F")("t ") +
  chalk.hex("#00AE76")("a") +
  chalk.hex("#00AE6D")("s") +
  chalk.hex("#00AE64")("t") +
  chalk.hex("#00AE5B")("r") +
  chalk.hex("#00AE51")("o") +
  chalk.hex("#00AE48")("n") +
  chalk.hex("#00AE3F")("a") +
  chalk.hex("#00AE36")("u") +
  chalk.hex("#00AE2D")("t!");
