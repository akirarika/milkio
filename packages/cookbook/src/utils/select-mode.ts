import { env } from "bun";
import consola from "consola";
import type { CookbookOptions } from "./cookbook-dto-types";
import chalk from "chalk";
import { asciis } from "./asciis";
import { uniqWith } from "lodash-es";
import { exit } from "node:process";
import { search } from "@inquirer/prompts";
import type { Params } from "..";

function reconstructCommand(suffix: string): string {
  const userArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--mode") && arg !== "--mode");
  return ["co", ...userArgs, suffix].filter(Boolean).join(" ");
}

export async function selectMode(options: CookbookOptions, params?: Params) {
  if (
    !options?.general?.modes ||
    options.general.modes.length === 0 ||
    options.general.modes.includes("test") === false
  ) {
    consola.warn(
      "The 'general->modes' is not configured. Edit your cookbook.toml file and add at least one mode, with 'test' being mandatory.",
    );
    process.exit(1);
  }

  const optionMode = params?.options?.mode;
  if (typeof optionMode === "string" && optionMode.length > 0) {
    if (options.general.modes.includes(optionMode) === false) {
      consola.warn(
        `The mode '${optionMode}' is not configured. Edit your cookbook.toml file and add it to the 'general->modes' array.`,
      );
      process.exit(1);
    }
    consola.info(`Mode: ${optionMode}`);
    return optionMode;
  }

  if (params?.subCommand) {
    let mode: string | undefined = undefined;
    if (options.general.modes.includes(params.subCommand)) mode = params.subCommand;
    for (const currMode of options.general.modes) {
      if (currMode.startsWith(params.subCommand)) {
        mode = currMode;
        break;
      }
    }
    if (!mode) {
      consola.error(
        `The mode '${params.subCommand}' is not configured. Edit your cookbook.toml file and add it to the 'general->modes' array.`,
      );
      process.exit(1);
    }
    return mode;
  }

  if (env?.COOKBOOK_MODE || env?.MODE) {
    const mode = `${env?.COOKBOOK_MODE || env?.MODE}`;
    if (mode) {
      if (options.general.modes.includes(mode) === false) {
        consola.warn(
          `The mode '${mode}' is not configured. Edit your cookbook.toml file and add it to the 'general->modes' array.`,
        );
        process.exit(1);
      }
      consola.info(`Mode: ${mode}`);
      return mode;
    }
  }

  console.log(asciis().join("\n"));
  console.log("");
  consola.info(
    chalk.hex("#E6E7E9")("Exits if no mode is selected in 15s."),
  );

  const items: Array<{ value: string }> = [];
  const cancel: any = {};
  cancel.value = options.general.modes.at(0);

  for (const itemName in options.general.modes) {
    const item = options.general.modes[itemName];
    items.push({ value: item });
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 15000);

  let selected: string | undefined;
  try {
    selected = await search(
      {
        message: "Select a mode:",
        source: async (input) => {
          if (!input) return items;
          const filtered = items.filter((item) =>
            containsCharsInOrder(input.toLowerCase(), item.value.toLowerCase()),
          );

          return uniqWith(filtered, (a, b) => a.value === b.value).sort((a, b) => {
            const scoreA = calculateScore(input, a.value);
            const scoreB = calculateScore(input, b.value);
            if (scoreB.maxContiguous !== scoreA.maxContiguous) {
              return scoreB.maxContiguous - scoreA.maxContiguous;
            }
            return scoreA.firstMatchIndex - scoreB.firstMatchIndex;
          });
        },
      },
      {
        signal: abortController.signal,
      },
    );
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (abortController.signal.aborted) {
      const exampleMode = options.general.modes[0];
      const suggested = reconstructCommand(`--mode=${exampleMode}`);
      consola.error(
        `Interactive prompt (select mode) was not answered within 15 seconds.\n\n` +
          `To run non-interactively, re-run with a mode, e.g.:\n  ${suggested}`,
      );
      process.exit(1);
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (selected === "<cancel>") {
    consola.success("Cookbook cancelled");
    exit(0);
  }

  if (!selected) {
    consola.success("Cookbook cancelled");
    exit(0);
  }
  return selected;
}

const containsCharsInOrder = (input: string, target: string): boolean => {
  let inputIndex = 0;
  for (const char of target) {
    if (char === input[inputIndex]) {
      inputIndex++;
      if (inputIndex === input.length) break;
    }
  }
  return inputIndex === input.length;
};
const calculateScore = (input: string, target: string) => {
  let maxContiguous = 0;
  let currentContiguous = 0;
  let firstMatchIndex = -1;

  let inputIndex = 0;
  for (let i = 0; i < target.length; i++) {
    if (target[i] === input[inputIndex]) {
      if (firstMatchIndex === -1) firstMatchIndex = i;
      currentContiguous++;
      inputIndex++;
      maxContiguous = Math.max(maxContiguous, currentContiguous);
    } else {
      currentContiguous = 0;
    }
  }

  return { maxContiguous, firstMatchIndex };
};
