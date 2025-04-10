import chalk from "chalk";
import { stdout } from "node:process";

const repeatString = (str: string, n: number) => str.repeat(n);

export function stdoutWrite(content: string, level: "info" | "warn" | "error") {
    let str = content;
    if (str.endsWith("\n")) str = str.slice(0, -1);
    if (level === "warn") str = chalk.hex("#ff9800")(str);
    if (level === "error") str = chalk.hex("#f44336")(str);

    const port = `${(globalThis as any).__COOKBOOK_OPTIONS__.general.cookbookPort ?? 0}`;
    stdout.write(`\r\x1b[K${str}\n${chalk.hex("#24B56A")("⠶ ")}${chalk.hex("#24B56A")("cookbook - ")}${chalk.hex("#4988fc")(`http://localhost:${port}/`)}${repeatString(" ", Math.max(0, stdout.columns - 32 - port.length))}`);
}