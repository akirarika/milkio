import consola from "consola";
import { join } from "node:path";
import os from "node:os";
import { exec } from "node:child_process";
import { getRate } from "../../progress";
import { defineWatcherExtension } from "../extensions";
import { exists, readdir } from "node:fs/promises";
import { getRuntime } from "../../utils/get-runtime";
import { getTypiaPath } from "../../utils/get-typia-path";
import chalk from "chalk";

export const routeTypiaWatcherExtension = defineWatcherExtension({
    async: false,
    filter: (file) => {
        return file.path.startsWith("modules/") && (file.type === "action" || file.type === "stream");
    },
    setup: async (root, mode, options, project, changeFiles, allFiles) => {
        const milkioGeneratedRouteDirPath = join(root, ".milkio", "generated", "routes");
        const milkioTranspiledRouteDirPath = join(root, ".milkio", "transpiled", "routes");

        const queue = new DynamicConcurrencyQueue();

        for (const file of allFiles) {
            queue.add(async () => {
                const generatedDirPath = join(milkioGeneratedRouteDirPath, file.importName);
                const transpiledDirPath = join(milkioTranspiledRouteDirPath, file.importName);

                if (!(await exists(generatedDirPath))) return;

                const hashDirs = await readdir(generatedDirPath);
                if (hashDirs.length === 0) return;

                const hashFile = hashDirs[hashDirs.length - 1];
                const hashFileName = `${hashFile}/schema.ts`;
                const generatedHashFilePath = join(generatedDirPath, hashFileName);
                const transpiledHashFilePath = join(transpiledDirPath, hashFileName);

                if (!(await exists(generatedHashFilePath))) return;

                // Skip if typia result already exists and up to date
                const generatedStat = await Bun.file(generatedHashFilePath).stat();
                const transpiledStat = await (async () => {
                    try { return await Bun.file(transpiledHashFilePath).stat(); } catch { return null; }
                })();
                if (transpiledStat && transpiledStat.mtime >= generatedStat.mtime) return;

                const typiaCommand = `${await getRuntime()} ${await getTypiaPath()} generate --input ${join(generatedDirPath, hashFile)} --output ${join(transpiledDirPath, hashFile)} --project ${join(root, "tsconfig.json")}`;

                try {
                    const output = await new Promise<string>((resolve, reject) => {
                        exec(typiaCommand, { cwd: root }, (error, stdout, stderr) => {
                            const fullOutput = stdout + stderr;
                            if (error) {
                                reject(new Error(fullOutput));
                            } else {
                                resolve(fullOutput);
                            }
                        });
                    });
                    if (output.includes("error ")) {
                        consola.error(`[${getRate()}] 🚨 typia fail, skip: ${file.path}\n${output}`);
                        return;
                    }
                } catch (error) {
                    consola.error(`[${getRate()}] 🚨 typia fail, skip: ${file.path}\n${error}`);
                    return;
                }
                consola.info(chalk.gray(`[${getRate()}] ✨ typia done: ${file.path}`));
            });
        }

        await queue.waitAll();
    },
});

class DynamicConcurrencyQueue {
    private concurrency: number;
    private queue: Array<() => Promise<void>> = [];
    private running: number = 0;
    public completed: number = 0;
    public total: number = 0;

    constructor() {
        const numCPUs = os.cpus().length;
        const totalMemoryBytes = os.totalmem();
        const totalMemoryGB = Math.floor(totalMemoryBytes / (1024 * 1024 * 1024));
        const cpuBasedConcurrency = Math.max(1, Math.ceil(numCPUs / 2));
        const memoryBasedConcurrency = totalMemoryGB <= 4 ? 1 : Math.min(8, (totalMemoryGB - 4) + 1);
        this.concurrency = Math.min(cpuBasedConcurrency, memoryBasedConcurrency);
        this.concurrency = Math.max(1, Math.floor(this.concurrency / 2));
    }

    add(task: () => Promise<void>): void {
        this.queue.push(task);
        this.total++;
        this.runNext();
    }

    private runNext(): void {
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }

        const task = this.queue.shift();
        if (!task) return;

        this.running++;

        task()
            .finally(() => {
                this.running--;
                this.completed++;
                this.runNext();
            });
    }

    async waitAll(): Promise<void> {
        if (this.total === 0) return;

        while (this.running > 0 || this.queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
}
