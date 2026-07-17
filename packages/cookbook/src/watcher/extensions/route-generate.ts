import consola from "consola";
import { join } from "node:path";
import os from "node:os";
import { getRate } from "../../progress";
import { defineWatcherExtension } from "../extensions";
import { exists, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { generateRunTs } from "../generate-run-ts/__IMPORTS__";
import { calcHash } from "../../utils/calc-hash";
import { unlinkIfTooLong } from "../../utils/unlink-if-too-long";
import { getRuntime } from "../../utils/get-runtime";
import { getTypiaPath } from "../../utils/get-typia-path";
import chalk from "chalk";

export const routeGenerateWatcherExtension = defineWatcherExtension({
    async: false,
    filter: (file) => {
        return file.path.startsWith("modules/") && (file.type === "action" || file.type === "stream");
    },
    setup: async (root, mode, options, project, changeFiles, allFiles) => {
        const milkioDirPath = join(root, ".milkio");
        const milkioGeneratedDirPath = join(milkioDirPath, "generated");
        const milkioTranspiledDirPath = join(milkioDirPath, "transpiled");
        const milkioGeneratedRouteDirPath = join(milkioDirPath, "generated", "routes");
        const milkioTranspiledRouteDirPath = join(milkioDirPath, "transpiled", "routes");
        if (!(await exists(milkioGeneratedDirPath))) await mkdir(milkioGeneratedDirPath, { recursive: true });
        if (!(await exists(milkioTranspiledDirPath))) await mkdir(milkioTranspiledDirPath, { recursive: true });
        if (!(await exists(milkioGeneratedRouteDirPath))) await mkdir(milkioGeneratedRouteDirPath, { recursive: true });
        if (!(await exists(milkioTranspiledRouteDirPath))) await mkdir(milkioTranspiledRouteDirPath, { recursive: true });

        await generateRunTs(project, milkioDirPath);

        // Generate preliminary route-schema.ts so test files can type-check route paths
        {
            let prelimRouteExports = "// route-schema (preliminary)\nconst routeSchema = {";
            const prelimRoutePaths = new Set<string>();
            for (const file of allFiles) {
                let routePath = file.path.slice(0, file.path.length - 10);
                if (routePath.endsWith("/index") || routePath === "index") routePath = routePath.slice(0, routePath.length - 5);
                if (routePath === "public" && routePath.length > 1) routePath = routePath.slice(0, routePath.length - 1);
                if (routePath.startsWith("modules/")) routePath = routePath.slice(8);
                if (routePath !== "/" && routePath.endsWith("/")) routePath = routePath.slice(0, routePath.length - 1);
                if (file.type === "stream") routePath = `${routePath}~`;
                if (prelimRoutePaths.has(routePath)) continue;
                prelimRoutePaths.add(routePath);
                prelimRouteExports += `\n  "/${routePath}": null,`;
            }
            prelimRouteExports += "\n} as const;\nexport default routeSchema;\n";
            await Bun.write(join(root, ".milkio", "route-schema.ts"), prelimRouteExports);
        }

        const queue = new DynamicConcurrencyQueue();

        for (const file of changeFiles) {
            queue.add(async () => {
                let isGenerate = false;
                const hashFile = calcHash(await readFile(join(file.projectFsPath, file.path)));
                const hashFileName = `${hashFile}/schema.ts`;
                const generatedDirPath = join(milkioGeneratedRouteDirPath, file.importName);
                const transpiledDirPath = join(milkioTranspiledRouteDirPath, file.importName);
                const generatedHashFilePath = join(generatedDirPath, hashFileName);

                if (!(await exists(generatedDirPath))) {
                    isGenerate = true;
                    await mkdir(generatedDirPath, { recursive: true });
                }
                if (!(await exists(transpiledDirPath))) {
                    isGenerate = true;
                    await mkdir(transpiledDirPath, { recursive: true });
                }

                if (!isGenerate && file.dependencyChanged) isGenerate = true;

                if (!isGenerate && !(await exists(generatedHashFilePath))) isGenerate = true;

                if (isGenerate === false) return;

                let routeFileImports = "// route-schema";
                routeFileImports += `\nimport typia, { type IValidation } from "typia";`;
                const typiaCommand = `${await getRuntime()} ${await getTypiaPath()} generate --input ${join(generatedDirPath, hashFile)} --output ${join(transpiledDirPath, hashFile)} --project ${join(root, "tsconfig.json")}`;
                let routeFileExports = `// typia command: ${typiaCommand}`;
                routeFileExports += "\nexport default { ";
                routeFileExports += `\ntype: "${file.type}", `;
                routeFileExports += "\ntypes: undefined as any as { ";
                routeFileExports += `\n"🥛": ${file.type === "action" ? "boolean" : "number"}, `;
                routeFileExports += `\nmeta: (typeof ${file.importName}) extends { meta: infer M } ? M : undefined, `;
                routeFileExports += `\nparams: Parameters<typeof ${file.importName}["handler"]>[1], `;
                routeFileExports += `\nresult: Awaited<ReturnType<typeof ${file.importName}["handler"]>> `;
                routeFileExports += "},";
                if (project?.lazyRoutes === undefined || project?.lazyRoutes === true) {
                    routeFileImports += `\nimport type * as ${file.importName} from "../../../../../app/${file.path}";`;
                    routeFileExports += `\nmodule: () => import("../../../../../app/${file.path}"), `;
                } else {
                    routeFileImports += `\nimport ${file.importName} from "../../../../../app/${file.path}";`;
                    routeFileExports += `\nmodule: () => ${file.importName}, `;
                }
                routeFileExports += `\nvalidateParams: (params: any): IValidation<Parameters<typeof ${file.importName}["handler"]>[1]> => typia.plain.validatePrune<Parameters<typeof ${file.importName}["handler"]>[1]>(params) as any, `;
                routeFileExports += `\nrandomParams: (): IValidation<Parameters<typeof ${file.importName}["handler"]>[1]> => typia.random<Parameters<typeof ${file.importName}["handler"]>[1]>() as any, `;
                routeFileExports += `\nvalidateResults: (results: any): IValidation<Awaited<ReturnType<typeof ${file.importName}["handler"]>>> => typia.plain.validatePrune<Awaited<ReturnType<typeof ${file.importName}["handler"]>>>(results) as any, `;
                routeFileExports += `\nresultsToJSON: (results: any): Awaited<ReturnType<typeof ${file.importName}["handler"]>> => {
  // @ts-ignore
  return typia.json.stringify<Awaited<ReturnType<typeof ${file.importName}["handler"]>>>(results) as any
}, `;
                routeFileExports += "\n};";

                const oldFiles = await readdir(generatedDirPath);

                await Bun.write(generatedHashFilePath, `${routeFileImports}\n\n${routeFileExports}\n`);

                const deleteQueue = new DynamicConcurrencyQueue();
                for (const oldFile of oldFiles) {
                    deleteQueue.add(async () => {
                        const oldFileGeneratedPath = join(generatedDirPath, oldFile);
                        const oldFileTranspiledPath = join(transpiledDirPath, oldFile);
                        if (await exists(oldFileGeneratedPath)) await unlinkIfTooLong(oldFileGeneratedPath);
                        if (await exists(oldFileTranspiledPath)) await unlinkIfTooLong(oldFileTranspiledPath);
                    });
                }
                await deleteQueue.waitAll();

                consola.info(chalk.gray(`[${getRate()}] ✨ route schema generated: ${file.path}`));
            });
        }

        await queue.waitAll();

        // Cleanup stale route dirs
        const validImportNames = new Set(allFiles.map((file) => file.importName));
        const cleanupQueue = new DynamicConcurrencyQueue();

        cleanupQueue.add(async () => {
            const generatedRouteDirs = await readdir(milkioGeneratedRouteDirPath, { withFileTypes: true });
            for (const dir of generatedRouteDirs) {
                if (!dir.isDirectory()) continue;
                if (validImportNames.has(dir.name)) continue;
                const dirPath = join(milkioGeneratedRouteDirPath, dir.name);
                await rm(dirPath, { recursive: true, force: true });
            }
        });

        cleanupQueue.add(async () => {
            const transpiledRouteDirs = await readdir(milkioTranspiledRouteDirPath, { withFileTypes: true });
            for (const dir of transpiledRouteDirs) {
                if (!dir.isDirectory()) continue;
                if (validImportNames.has(dir.name)) continue;
                const dirPath = join(milkioTranspiledRouteDirPath, dir.name);
                await rm(dirPath, { recursive: true, force: true });
            }
        });

        await cleanupQueue.waitAll();
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
