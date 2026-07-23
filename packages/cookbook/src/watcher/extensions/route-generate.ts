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

        // Generate preliminary route-schema.ts so test files can type-check route paths.
        // IMPORTANT: each entry must carry a proper "🥛" discriminator (false for actions,
        // 0 for streams) so that stargate.execute()'s conditional type resolves to the
        // correct branch (action tuple vs stream tuple) instead of distributing over
        // `any` and producing a union that includes AsyncGenerator. Using `null` here
        // causes `null['types']` to collapse to `any`, and `any extends boolean` takes
        // BOTH branches — which creates cascade type errors in business code that
        // accesses properties on the result. params/result are typed as `any` so that
        // business code can be type-checked against route paths even before typia has
        // generated the final schema.
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
                // 🥛 discriminator: false (literal) for actions → `false extends boolean` = true → action branch
                //                    0   (literal) for streams → `0 extends boolean` = false → stream branch
                const discriminator = file.type === "stream" ? "0" : "false";
                prelimRouteExports += `\n  "/${routePath}": { types: { "\u{1F95B}": ${discriminator}, params: undefined as any, result: undefined as any } },`;
            }
            prelimRouteExports += "\n} as const;\nexport default routeSchema;\n";
            const prelimPath = join(root, ".milkio", "route-schema.ts");
            // 比较内容，相同则跳过写入，避免触发 vite page reload
            let oldPrelimContent: string | null = null;
            try { oldPrelimContent = await Bun.file(prelimPath).text(); } catch {}
            if (oldPrelimContent !== prelimRouteExports) {
                await Bun.write(prelimPath, prelimRouteExports);
            }
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
                routeFileImports += `\nimport typia, { type IValidation, type Resolved } from "typia";`;
                const typiaCommand = `${await getRuntime()} ${await getTypiaPath()} generate --input ${join(generatedDirPath, hashFile)} --output ${join(transpiledDirPath, hashFile)} --project ${join(root, "tsconfig.json")}`;
                let routeFileExports = `// typia command: ${typiaCommand}`;
                routeFileExports += "\nexport default { ";
                routeFileExports += `\ntype: "${file.type}", `;
                routeFileExports += "\ntypes: undefined as any as { ";
                routeFileExports += `\n"🥛": ${file.type === "action" ? "boolean" : "number"}, `;
                routeFileExports += `\nmeta: (typeof ${file.importName}) extends { meta: infer M } ? M : undefined, `;
                routeFileExports += `\nparams: Resolved<Parameters<typeof ${file.importName}["handler"]>[1]>, `;
                // For actions, `result` is the return value with typia tags stripped.
                // For streams, the return type is `AsyncGenerator<YieldType>`, and
                // `Resolved<T>` (from @typia/interface) destroys AsyncGenerator types
                // by mapping over all properties. So for streams we store the yield
                // type directly — the caller never needs the full AsyncGenerator shape
                // from the schema.
                routeFileExports += `\nresult: ${file.type === "action" ? "Resolved<Awaited<" : "Awaited<"}ReturnType<typeof ${file.importName}["handler"]>${file.type === "action" ? ">>" : "> extends AsyncGenerator<infer I> ? I : never"} `;
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

                const newGeneratedContent = `${routeFileImports}\n\n${routeFileExports}\n`;
                // 比较内容，相同则跳过写入，避免 mtime 更新触发 typia 重新 transpile + vite reload
                let oldGeneratedContent: string | null = null;
                try { oldGeneratedContent = await Bun.file(generatedHashFilePath).text(); } catch {}
                if (oldGeneratedContent !== newGeneratedContent) {
                    await Bun.write(generatedHashFilePath, newGeneratedContent);
                }

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
