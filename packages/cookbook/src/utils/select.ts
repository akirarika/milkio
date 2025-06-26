import { search } from "@inquirer/prompts";
import consola from "consola";
import { uniqWith } from "lodash-es";
import { exit } from "node:process";

export async function select<Data extends Record<any, any>>(message: `${string}:`, data: Array<Data>, key: keyof Data, used?: string): Promise<Data> {
  const items: Array<{ value: string }> = [];
  const cancel: any = {};
  cancel.value = "<cancel>";
  items.unshift(cancel);

  for (const itemName in data) {
    const item = data[itemName];
    items.push({ value: item[key] });
  }

  const selected =
    used ??
    (await search({
      message: message,
      source: async (input) => {
        if (!input) return items;
        const filtered = items.filter((item) => containsCharsInOrder(input.toLowerCase(), item.value.toLowerCase()));

        return uniqWith(filtered, (a, b) => a.value === b.value).sort((a, b) => {
          const scoreA = calculateScore(input, a.value);
          const scoreB = calculateScore(input, b.value);
          if (scoreB.maxContiguous !== scoreA.maxContiguous) {
            return scoreB.maxContiguous - scoreA.maxContiguous;
          }
          return scoreA.firstMatchIndex - scoreB.firstMatchIndex;
        });
      },
    }));

  if (selected === "<cancel>") {
    consola.success("Cookbook cancelled");
    exit(0);
  }

  const item = data.find((item) => item[key] === selected);
  if (!item) {
    consola.success("Cookbook cancelled");
    exit(0);
  }
  return { ...item };
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
