import chalk from "chalk";

let maxNameLength = "cookbook".length;
const colors = ["448aff", "ff4081", "7c4dff", "b2ff59", "ffd740"];

export function outputPrefix(key: string, id: number, icon = "・") {
  setMaxNameLength(key);
  let prefix = `${chalk.hex("a626a4")(icon)}${chalk.hex(colors[id % colors.length])(`[${key}]`)}`;
  for (let index = 0; index <= maxNameLength - key.length; index++) prefix += " ";
  return prefix;
}

export function setMaxNameLength(key: string) {
  if (maxNameLength < key.length) maxNameLength = key.length;
}
