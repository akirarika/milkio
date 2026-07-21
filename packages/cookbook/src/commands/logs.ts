import { defineCookbookCommand } from "@milkio/cookbook-command";
import consola from "consola";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { stdout } from "node:process";
import { getLogsDir } from "../utils/background";

export default await defineCookbookCommand(async (utils) => {
    const logsDir = getLogsDir();

    const listLogFiles = async (): Promise<Array<string>> => {
        try {
            const entries = await readdir(logsDir);
            return entries.filter((name) => /^\d+(-\d+)?\.log$/.test(name));
        } catch {
            return [];
        }
    };

    // the most recent log file is the one with the largest millisecond timestamp
    const newestFile = async (): Promise<string | undefined> => {
        const files = await listLogFiles();
        if (files.length === 0) return undefined;
        files.sort((a, b) => {
            const timestampA = Number(a.split(".log")[0].split("-")[0]);
            const timestampB = Number(b.split(".log")[0].split("-")[0]);
            if (timestampA !== timestampB) return timestampA - timestampB;
            return a.localeCompare(b);
        });
        return files[files.length - 1];
    };

    let current: string | undefined;
    let offset = 0;
    let announced = false;

    // print everything from `fromOffset` to the end of `file`, preserving the raw
    // bytes (including ANSI color codes), and return the new offset
    const drain = async (file: string, fromOffset: number): Promise<number> => {
        let buffer: Buffer;
        try {
            buffer = await readFile(join(logsDir, file));
        } catch {
            return fromOffset;
        }
        if (buffer.length < fromOffset) fromOffset = 0; // file was cleared / replaced
        if (buffer.length > fromOffset) {
            stdout.write(buffer.subarray(fromOffset));
            fromOffset = buffer.length;
        }
        return fromOffset;
    };

    const tick = async () => {
        const newest = await newestFile();
        if (!newest) {
            if (!announced) {
                consola.info(`No logs yet. Waiting for logs in ${logsDir} ..`);
                announced = true;
            }
            return;
        }
        if (current === undefined) {
            current = newest;
            offset = 0;
        } else if (newest !== current) {
            // a newer log file appeared (rotation or a fresh start): finish the old
            // file, then follow the new one from the beginning
            offset = await drain(current, offset);
            current = newest;
            offset = 0;
        }
        offset = await drain(current, offset);
    };

    await tick();
    const resolvers = Promise.withResolvers();
    setInterval(() => {
        void tick();
    }, 500);
    await resolvers.promise; // follow forever
});
