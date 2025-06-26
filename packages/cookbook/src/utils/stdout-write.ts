import chalk from "chalk";
import { stdout } from "node:process";

const repeatString = (str: string, n: number) => str.repeat(n);

export function stdoutWrite(content: string) {
    let str = content;
    if (str.endsWith("\n")) str = str.slice(0, -1);
    const port = `${(globalThis as any).__COOKBOOK_OPTIONS__.general.cookbookPort ?? 0}`;
    stdout.write(`\r\x1b[K${str}\n${chalk.hex("#24B56A")("⠶ ")}${chalk.hex("#24B56A")("cookbook - ")}${chalk.hex("#4988fc")(`http://localhost:${port}/`)}${repeatString(" ", Math.max(0, stdout.columns - 32 - port.length))}`);
}