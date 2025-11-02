import { $ } from "bun";
import consola from "consola";
import { join } from "node:path";
import { getRate } from "../../progress";
import { defineWatcherExtension } from "../extensions";
import { exists, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { generateRunTs } from "../generate-run-ts/__IMPORTS__";
import { calcHash } from "../../utils/calc-hash";
import { unlinkIfTooLong } from "../../utils/unlink-if-too-long";
import { getRuntime } from "../../utils/get-runtime";
import { getTypiaPath } from "../../utils/get-typia-path";
import { getLatestSchemaFolder } from "../../utils/get-latest-schema-folder";
import { exit } from "node:process";
import chalk from "chalk";

export const routeWatcherExtension = defineWatcherExtension({
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

        let tasks: Array<Promise<void>> = [];
        const hashes: Map<string, string> = new Map();
        for (const file of changeFiles) {
            tasks.push(
                (async () => {
                    let isGenerate = false;
                    const hashFile = calcHash(await readFile(join(file.projectFsPath, file.path)));
                    const hashFileName = `${hashFile}/schema.ts`;
                    const generatedDirPath = join(milkioGeneratedRouteDirPath, file.importName);
                    const transpiledDirPath = join(milkioTranspiledRouteDirPath, file.importName);
                    const generatedHashFilePath = join(generatedDirPath, hashFileName);
                    const transpiledHashFilePath = join(transpiledDirPath, hashFileName);
                    hashes.set(file.importName, hashFile);

                    if (!(await exists(generatedDirPath))) {
                        isGenerate = true;
                        await mkdir(generatedDirPath, { recursive: true });
                    }
                    if (!(await exists(transpiledDirPath))) {
                        isGenerate = true;
                        await mkdir(transpiledDirPath, { recursive: true });
                    }

                    if (!isGenerate && file.dependencyChanged) isGenerate = true;

                    if (!isGenerate && (!(await exists(generatedHashFilePath)) || !(await exists(transpiledHashFilePath)))) isGenerate = true;

                    if (isGenerate === false) return;

                    let routeFileImports = "// route-schema";
                    routeFileImports += `\nimport typia, { type IValidation } from "typia";`;
                    let routeFileExports = `// typia command: ${await getRuntime()} ${await getTypiaPath()} generate --input ${join(generatedDirPath, hashFile)} --output ${join(transpiledDirPath, hashFile)} --project ${join(root, "tsconfig.json")}`;
                    routeFileExports += "export default { ";
                    routeFileExports += `\ntype: "${file.type}", `;
                    routeFileExports += "\ntypes: undefined as any as { ";
                    routeFileExports += `\n"🥛": ${file.type === "action" ? "boolean" : "number"}, `;
                    routeFileExports += `\nmeta: typeof ${file.importName}["meta"], `;
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
                    routeFileExports += `\nvalidateParams: (params: any): IValidation<Parameters<typeof ${file.importName}["handler"]>[1]> => typia.misc.validatePrune<Parameters<typeof ${file.importName}["handler"]>[1]>(params) as any, `;
                    routeFileExports += `\nrandomParams: (): IValidation<Parameters<typeof ${file.importName}["handler"]>[1]> => typia.random<Parameters<typeof ${file.importName}["handler"]>[1]>() as any, `;
                    routeFileExports += `\nvalidateResults: (results: any): IValidation<Awaited<ReturnType<typeof ${file.importName}["handler"]>>> => typia.misc.validatePrune<Awaited<ReturnType<typeof ${file.importName}["handler"]>>>(results) as any, `;
                    routeFileExports += `\nresultsToJSON: (results: any): Awaited<ReturnType<typeof ${file.importName}["handler"]>> => {
  // @ts-ignore
  return typia.json.stringify<Awaited<ReturnType<typeof ${file.importName}["handler"]>>>(results) as any
}, `;
                    routeFileExports += "\n};";

                    const oldFiles = await readdir(generatedDirPath);

                    await Bun.write(generatedHashFilePath, `${routeFileImports}\n\n${routeFileExports}\n`);

                    const deleteTasks: Array<Promise<any>> = [];
                    for (const oldFile of oldFiles) {
                        const oldFileGeneratedPath = join(generatedDirPath, oldFile);
                        const oldFileTranspiledPath = join(transpiledDirPath, oldFile);
                        if (await exists(oldFileGeneratedPath)) deleteTasks.push(unlinkIfTooLong(oldFileGeneratedPath));
                        if (await exists(oldFileTranspiledPath)) deleteTasks.push(unlinkIfTooLong(oldFileTranspiledPath));
                    }

                    await Promise.all(deleteTasks);

                    try {
                        await $`${await getRuntime()} ${await getTypiaPath()} generate --input ${join(generatedDirPath, hashFile)} --output ${join(transpiledDirPath, hashFile)} --project ${join(root, "tsconfig.json")}`.cwd(root).quiet();
                    } catch (error) {
                        consola.warn(`[${getRate()}] ⚠️ type-safety fail, skip: ${file.path}\n${error}`);
                    }
                    consola.info(chalk.gray(`[${getRate()}] ✨ type-safety now: ${file.path}`));
                })(),
            );
        }

        await Promise.all(tasks);
        tasks = [];

        const validImportNames = new Set(allFiles.map((file) => file.importName));

        tasks.push(
            (async () => {
                const generatedRouteDirs = await readdir(milkioGeneratedRouteDirPath, { withFileTypes: true });
                for (const dir of generatedRouteDirs) {
                    if (!dir.isDirectory()) continue;
                    if (validImportNames.has(dir.name)) continue;

                    const dirPath = join(milkioGeneratedRouteDirPath, dir.name);
                    await rm(dirPath, { recursive: true, force: true });
                }
            })(),
        );
        tasks.push(
            (async () => {
                const transpiledRouteDirs = await readdir(milkioTranspiledRouteDirPath, { withFileTypes: true });
                for (const dir of transpiledRouteDirs) {
                    if (!dir.isDirectory()) continue;
                    if (validImportNames.has(dir.name)) continue;

                    const dirPath = join(milkioTranspiledRouteDirPath, dir.name);
                    await rm(dirPath, { recursive: true, force: true });
                }
            })(),
        );

        await Promise.all(tasks);
        tasks = [];

        let routeSchemaFileImports = "// route-schema";
        let routeSchemaFileExports = "export default {";

        const routePaths: Set<string> = new Set();
        for (const file of allFiles) {
            let hashFile = hashes.get(file.importName);
            if (!hashFile) hashFile = await getLatestSchemaFolder(join(milkioGeneratedRouteDirPath, file.importName));
            const hashFileName = `${hashFile}/schema.ts`;

            let routePath = file.path.slice(0, file.path.length - 10); // 10 === ".stream.ts".length && 10 === ".action.ts".length
            if (routePath.endsWith("/index") || routePath === "index") routePath = routePath.slice(0, routePath.length - 5); // 5 === "index".length
            if (routePath === "public" && routePath.length > 1) routePath = routePath.slice(0, routePath.length - 1);
            if (routePath.startsWith("modules/")) routePath = `${routePath.slice(8)}`; // 8 === "modules/".length
            if (routePath !== "/" && routePath.endsWith("/")) routePath = routePath.slice(0, routePath.length - 1);
            if (file.type === "stream") routePath = `${routePath}~`;
            if (routePaths.has(routePath)) {
                consola.error(`Invalid path: "${file.path}". The most common reason for having paths duplicate is that you created a new "${file}" and have a "${file}/index.ts".\n`);
                exit(1);
            }
            routePaths.add(routePath);

            routeSchemaFileImports += `\nimport ${file.importName} from "./transpiled/routes/${file.importName}/${hashFileName}";`;
            routeSchemaFileExports += `\n  "/${routePath}": ${file.importName},`;
        }
        routeSchemaFileExports += "\n};";

        const writePath = join(root, ".milkio", "route-schema.ts");

        await Bun.write(writePath, `${routeSchemaFileImports}\n\n${routeSchemaFileExports}\n`);
    },
});
