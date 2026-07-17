import consola from "consola";
import { join, relative } from "node:path";
import os from "node:os";
import { exec } from "node:child_process";
import { getRate } from "../../progress";
import { defineWatcherExtension } from "../extensions";
import { exists, readdir, rm } from "node:fs/promises";
import { getRuntime } from "../../utils/get-runtime";
import { getTypiaPath } from "../../utils/get-typia-path";
import { getLatestSchemaFolder } from "../../utils/get-latest-schema-folder";
import chalk from "chalk";

export const routeTypiaWatcherExtension = defineWatcherExtension({
    async: false,
    filter: (file) => {
        return file.path.startsWith("modules/") && (file.type === "action" || file.type === "stream");
    },
    setup: async (root, mode, options, project, changeFiles, allFiles) => {
        const milkioGeneratedRouteDirPath = join(root, ".milkio", "generated", "routes");
        const milkioTranspiledRouteDirPath = join(root, ".milkio", "transpiled", "routes");

        const projectTsconfigPath = join(root, "tsconfig.json");

        const queue = new DynamicConcurrencyQueue();

        for (const file of allFiles) {
            queue.add(async () => {
                const generatedDirPath = join(milkioGeneratedRouteDirPath, file.importName);
                const transpiledDirPath = join(milkioTranspiledRouteDirPath, file.importName);

                if (!(await exists(generatedDirPath))) return;

                // Select the latest hash folder by birthtime, consistent with
                // route.ts (which uses getLatestSchemaFolder). Previously this
                // used `hashDirs[hashDirs.length - 1]` (readdir order, roughly
                // alphabetical), which could differ from the latest-by-birthtime
                // folder when multiple hash folders exist. When they disagreed,
                // typia processed one folder while route.ts looked for the
                // transpiled file in another, causing routes to go missing from
                // route-schema.ts.
                let hashFile: string;
                try {
                    hashFile = await getLatestSchemaFolder(generatedDirPath);
                } catch {
                    return;
                }
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

                // Create a temporary tsconfig that only includes the generated schema file.
                //
                // The project's tsconfig has `include: ["./**/*", "./.milkio/**/*"]`, which
                // makes every action file a project member. Action files export `handler`
                // functions whose inferred types carry typia tags (Pattern, Minimum, Maximum,
                // MaxLength, Type) from drizzle table definitions (e.g.
                // `.$type<string & typia.tags.Pattern<'...'>>()`). When tsgo type-checks
                // these files as project members, it validates that all inferred types can
                // be named in declaration files, triggering TS2883: "The inferred type of
                // 'handler' cannot be named without a reference to 'Pattern' from '...'".
                //
                // By narrowing `include` to only the schema file, action files become
                // external dependencies rather than project members. tsgo still resolves
                // their types (needed for typia to generate validators) but does not check
                // their exports for declaration-namability. The schema file itself is safe
                // because its exports use type assertions (`undefined as any as { ... }`)
                // and explicit return type annotations on all functions, which are not
                // subject to TS2883 (it only applies to inferred types).
                const tempTsconfigDir = join(generatedDirPath, hashFile);
                const tempTsconfigPath = join(tempTsconfigDir, "tsconfig.typia.json");

                // Locate the nearest node_modules/@types directory by walking up from the
                // project root. The temp tsconfig lives deep inside
                // `.milkio/generated/routes/...`, and tsgo may not walk far enough up the
                // directory tree to discover `@types/*` packages (e.g. `@types/node` which
                // is hoisted to the workspace root). Explicitly setting `typeRoots` ensures
                // Node.js globals (Buffer, Error.captureStackTrace, NodeJS.Timeout) and all
                // other `@types/*` packages remain available during typia generation.
                let typeRootsPath: string | null = null;
                let currentDir = root;
                for (let i = 0; i < 10; i++) {
                    const candidate = join(currentDir, "node_modules", "@types");
                    if (await exists(candidate)) {
                        typeRootsPath = candidate.replace(/\\/g, "/");
                        break;
                    }
                    const parent = join(currentDir, "..");
                    if (parent === currentDir) break;
                    currentDir = parent;
                }

                // Collect ambient declaration files (.d.ts) from the project root.
                // Files like `vite-env.d.ts` contain triple-slash directives
                // (`/// <reference types="vite/client" />`) that pull in additional type
                // declarations (e.g. `import.meta.env`). Without explicitly listing them,
                // narrowing `include` to only `./schema.ts` drops these ambient
                // declarations, causing "Property 'env' does not exist on type 'ImportMeta'"
                // and similar errors in transitive imports.
                const projectRootEntries = await readdir(root);
                const ambientDtsFiles = projectRootEntries
                    .filter((entry) => entry.endsWith(".d.ts"))
                    .map((entry) => join(root, entry).replace(/\\/g, "/"));

                // Create a local ambient declaration file that directly references
                // `@types/node` via a relative path. tsgo (used by typia) does not reliably
                // discover `@types/*` packages through `typeRoots` when the temp tsconfig
                // extends a base tsconfig from a different directory. A `/// <reference path>`
                // directive bypasses `typeRoots` resolution and loads the Node.js type
                // declarations (Buffer, Error.captureStackTrace, NodeJS.Timeout, etc.)
                // directly. This mirrors how `vite-env.d.ts` pulls in `vite/client` types.
                const nodeEnvDtsPath = join(tempTsconfigDir, "node-env.d.ts");
                let nodeTypesIndexPath: string | null = null;
                if (typeRootsPath) {
                    const candidateIndex = join(typeRootsPath, "node", "index.d.ts");
                    if (await exists(candidateIndex)) {
                        nodeTypesIndexPath = candidateIndex.replace(/\\/g, "/");
                    }
                }
                if (nodeTypesIndexPath) {
                    const relativeNodeTypesPath = relative(tempTsconfigDir, nodeTypesIndexPath).replace(/\\/g, "/");
                    await Bun.write(nodeEnvDtsPath, `/// <reference path="${relativeNodeTypesPath}" />\n`);
                }

                const tempTsconfig: Record<string, any> = {
                    extends: projectTsconfigPath.replace(/\\/g, "/"),
                    compilerOptions: {
                        // Override composite/declaration settings from the base project.
                        //
                        // Some embed projects (e.g. kecream-app-embed) use `composite: true`
                        // with `declaration: true` and `emitDeclarationOnly: true` so they can
                        // be referenced by other composite projects. When we narrow `include`
                        // to only the schema file, composite projects reject the narrowed file
                        // list with "Projects must list all files or use an 'include' pattern".
                        // Disabling composite and declaration emit removes that constraint and
                        // also makes it explicit that this temp project is only used to feed
                        // typia's in-memory transform, not to produce declaration output.
                        composite: false,
                        declaration: false,
                        emitDeclarationOnly: false,
                        // Explicitly register the typia transformer plugin.
                        //
                        // `ttsc` (the Typia TypeScript Compiler used by `typia generate`)
                        // discovers transformer plugins from two sources:
                        //   1. `compilerOptions.plugins` in the tsconfig
                        //   2. Auto-discovery from direct dependencies' `ttsc.plugin` field
                        //
                        // In this monorepo, `typia` is a dependency of the workspace root
                        // (`kecream-projects/package.json`), not a direct dependency of each
                        // individual project (`kecream-server/package.json`, etc.). Because
                        // `ttsc`'s auto-discovery only walks the nearest `package.json`'s
                        // `dependencies`/`devDependencies`, it never sees typia's
                        // `ttsc.plugin` config, and the transformer is never loaded. Without
                        // the transformer, `typia generate` emits the schema file with raw
                        // `typia.plain.validatePrune<T>(...)` calls untransformed, which throw
                        // `NoTransformConfigurationError` at runtime.
                        //
                        // Explicitly listing the plugin here ensures the typia Go transformer
                        // (`typia/native/cmd/ttsc-typia`, resolved via `typia/lib/transform`)
                        // is built and applied regardless of where `typia` is declared in the
                        // dependency tree. This temp tsconfig is only consumed by `typia
                        // generate` (via `ttsc`), never by standard `tsc`, so the `transform`
                        // plugin format (which differs from tsc's `name`-based format) is safe.
                        plugins: [{ transform: "typia/lib/transform" }],
                    },
                    include: ["./schema.ts"],
                };
                if (typeRootsPath) {
                    tempTsconfig.compilerOptions.typeRoots = [typeRootsPath];
                }
                const allFiles = [...ambientDtsFiles];
                if (nodeTypesIndexPath) {
                    allFiles.push(nodeEnvDtsPath.replace(/\\/g, "/"));
                }
                if (allFiles.length > 0) {
                    tempTsconfig.files = allFiles;
                }
                await Bun.write(tempTsconfigPath, JSON.stringify(tempTsconfig, null, 2));

                const typiaCommand = `${await getRuntime()} ${await getTypiaPath()} generate --input ${join(generatedDirPath, hashFile)} --output ${join(transpiledDirPath, hashFile)} --project ${tempTsconfigPath}`;

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
                    consola.info(chalk.gray(`[${getRate()}] ✨ typia done: ${file.path}`));
                } catch (error) {
                    consola.error(`[${getRate()}] 🚨 typia fail, skip: ${file.path}\n${error}`);
                    return;
                } finally {
                    // Clean up the temporary tsconfig and node-env.d.ts to avoid leaving stale files
                    await rm(tempTsconfigPath, { force: true }).catch(() => {});
                    await rm(nodeEnvDtsPath, { force: true }).catch(() => {});
                }
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
