import { env } from "bun";
import consola from "consola";
import { select } from "./select";
import type { CookbookOptions } from "./cookbook-dto-types";
import chalk from "chalk";
import { asciis } from "./asciis";

export async function getMode(options: CookbookOptions) {
  if (!options?.general?.modes || options.general.modes.length === 0 || options.general.modes.includes("development") === false) {
    consola.warn("The 'general->modes' is not configured. Edit your cookbook.toml file and add at least one mode, with 'development' being mandatory.");
    process.exit(1);
  }

  if (env?.MODE) {
    if (options.general.modes.includes(env.MODE) === false) {
      consola.warn(`The mode '${env.MODE}' is not configured. Edit your cookbook.toml file and add it to the 'general->modes' array.`);
      process.exit(1);
    }
    consola.info(`Mode: ${env.MODE}`);
    return env.MODE;
  }

  console.log(asciis().join("\n"));
  console.log("");
  consola.start(chalk.hex("#E6E7E9")("The configurations used by milkio vary under different modes."));
  consola.start(chalk.hex("#E6E7E9")("If the MODE environment variable is set, it will skip the mode selection dialog."));
  const mode = await select(
    "Select a mode:",
    options.general.modes.map((mode) => ({ value: mode })),
    "value",
  );
  return mode.value;
}
