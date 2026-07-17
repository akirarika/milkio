import TOML from "@iarna/toml";
import { join } from "node:path";
import { cwd, env } from "node:process";
import { existsSync, readdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { PluginOption } from "vite";
import { readFile, writeFile } from "node:fs/promises";
import { adapters } from "./adapters/index.ts";

export function useVitePluginMilkio(options?: {
    outputFormat?: "esm" | "cjs";
}): PluginOption {
    let outDir = "dist";

    return {
        name: "vite-plugin-milkio",
        async configureServer(server) {
            let milkioPromise: Promise<any> | null = null;

            const getMilkio = async () => {
                if (!milkioPromise) {
                    milkioPromise = (async () => {
                        const app = await server.ssrLoadModule("index.ts", { fixStacktrace: false });
                        return await app.create({
                            port: Number(env.MILKIO_PORT),
                            develop: Boolean(env.COOKBOOK_BASE_URL),
                            fetchEnv: (key: string) => env[key] ?? undefined,
                        });
                    })();
                }
                return milkioPromise;
            };

            const envMode = env.COOKBOOK_MODE ?? (env.COOKBOOK_DEVELOP === "ENABLE" ? "development" : "production");

            // Cache for pathArray to avoid repeated split() on same pathname
            let lastPathname = "";
            let lastPathArray: string[] = [];

            server.middlewares.use(async (req, res, next) => {
                try {
                    const milkio = await getMilkio();
                    // Read body chunks
                    let bodyBuffer: Buffer | null = null;
                    let bodyChunks: Buffer[] | null = null;
                    req.on("data", (chunk: Buffer) => {
                        if (bodyBuffer === null) {
                            bodyBuffer = chunk;
                        } else {
                            if (bodyChunks === null) {
                                bodyChunks = [bodyBuffer, chunk];
                                bodyBuffer = null;
                            } else {
                                bodyChunks.push(chunk);
                            }
                        }
                    });
                    req.on("end", () => {
                        const method = req.method ?? "GET";
                        const body: Uint8Array | null = bodyChunks ? Buffer.concat(bodyChunks) : bodyBuffer;
                        const bodyText = body ? Buffer.from(body).toString("utf-8") : "";

                        // Build full URL for standard Request
                        const reqUrl = req.url ?? "/";
                        const protocol = (req as any).encrypted ? "https" : "http";
                        const host = req.headers.host ?? "localhost";
                        const fullUrl = `${protocol}://${host}${reqUrl}`;

                        // Build standard Headers from Node.js incoming headers
                        const headers = new Headers();
                        for (const [key, value] of Object.entries(req.headers)) {
                            if (value === undefined) continue;
                            if (Array.isArray(value)) {
                                for (const v of value) headers.append(key, v);
                            } else {
                                headers.set(key, value);
                            }
                        }

                        // Create AbortController for stream requests
                        const isStream = req.headers.accept?.startsWith("text/event-stream");
                        const signal = isStream ? (() => {
                            const ac = new AbortController();
                            res.on("close", () => { ac.abort(); });
                            return ac.signal;
                        })() : undefined;

                        // Construct standard Request object
                        const request = new Request(fullUrl, {
                            method,
                            headers,
                            body: method !== "GET" && method !== "HEAD" ? body as BodyInit | null : undefined,
                            signal,
                        });

                        // Attach pre-read data for Fast Path optimization
                        const qIndex = reqUrl.indexOf("?");
                        const pathname = qIndex >= 0 ? reqUrl.substring(0, qIndex) : reqUrl;
                        (request as any).__bodyText = bodyText;
                        (request as any).__pathname = pathname;
                        let pathArray: string[];
                        if (pathname === lastPathname) {
                            pathArray = lastPathArray;
                        } else {
                            pathArray = pathname.length > 1 ? pathname.substring(1).split("/") : [];
                            lastPathname = pathname;
                            lastPathArray = pathArray;
                        }
                        (request as any).__pathArray = pathArray;
                        (request as any).__origin = req.headers.origin ?? null;
                        (request as any).__isAction = !isStream;

                        milkio.listener.fetch({
                            request,
                            env: env,
                            envMode,
                            rawResponse: true,
                        }).then((response: any) => {
                            if (response.__rawResponse) {
                                res.writeHead(response.status, response.headers);
                                const resBody = response.body;
                                if (typeof resBody === 'string') {
                                    res.end(Buffer.from(resBody, 'utf-8'));
                                } else if (resBody instanceof Uint8Array || Buffer.isBuffer(resBody)) {
                                    res.end(resBody);
                                } else if (resBody instanceof ArrayBuffer) {
                                    res.end(Buffer.from(resBody));
                                } else if (resBody instanceof Blob) {
                                    resBody.arrayBuffer().then((ab: ArrayBuffer) => {
                                        res.end(Buffer.from(ab));
                                    });
                                } else if (resBody != null) {
                                    res.end(resBody);
                                } else {
                                    res.end();
                                }
                            } else {
                                // Standard Response object path (stream, OPTIONS, etc.)
                                const resHeaders: Record<string, string | string[]> = {};
                                for (const [key, value] of response.headers) {
                                    if (key in resHeaders) {
                                        const existing = resHeaders[key];
                                        if (Array.isArray(existing)) existing.push(value);
                                        else resHeaders[key] = [existing, value];
                                    } else {
                                        resHeaders[key] = value;
                                    }
                                }
                                res.writeHead(response.status, resHeaders);
                                if (response.body != null && req.method !== "HEAD") {
                                    const reader = response.body.getReader();
                                    const pump = (): Promise<void> =>
                                        reader.read().then(({ done, value }: { done: boolean; value?: Uint8Array }) => {
                                            if (done) { res.end(); return; }
                                            res.write(value);
                                            return pump();
                                        });
                                    pump();
                                } else {
                                    res.end();
                                }
                            }
                        }).catch((error: any) => {
                            console.error(error);
                            if (!res.headersSent) res.writeHead(500);
                            res.end("Internal Server Error");
                        });
                    });
                } catch (e) {
                    if (e instanceof Error) server.ssrFixStacktrace(e);
                    return next(e);
                }
            });
        },

        async config(config, { command }) {
            if (command !== "build") return;
            const project = await getCookbookTomlProject();

            // config.build
            if (!config.build) config.build = {};
            config.build.ssr = true;
            config.build.sourcemap = "inline";
            config.build.target = "es2024";
            // config.build.rollupOptions
            if (!config.build.rollupOptions) config.build.rollupOptions = {};
            // config.build.rollupOptions.output
            if (!config.build.rollupOptions.output) config.build.rollupOptions.output = {};
            // config.build.rollupOptions.input
            config.build.rollupOptions.input = {
                index: ".milkio/run.ts",
            };

            if (!project.adapter) {
                let format: "esm" | "cjs" = "esm";
                // oxlint-disable-next-line no-unused-vars
                let mode: "chunk" | "bundle" = "bundle";
                if (project.runtime === "node") {
                    format = options?.outputFormat ?? "cjs";
                    mode = "chunk";
                } else if (project.runtime === "deno" || project.runtime === "bun") {
                    format = options?.outputFormat ?? "esm";
                    mode = "chunk";
                } else throw new Error("runtime not supported");
                for (const output of Array.isArray(config.build.rollupOptions.output) ? config.build.rollupOptions.output : [config.build.rollupOptions.output]) {
                    output.format = format;
                    output.preserveModules = false;
                }
            } else {
                let find = false;
                for (const adapter of adapters) {
                    if (adapter.name === project.adapter) {
                        find = true;
                        const result = await adapter.adapter({
                            project,
                            command,
                            config,
                        });
                        config.build.rollupOptions.input = result.input;
                        config.build.rollupOptions.output = result.output;
                        break;
                    }
                }
                if (!find) throw new Error(`adapter "${project.adapter}" not found`);
            }

            // config.server
            if (!config.server) config.server = {};
            // config.server.middlewareMode
            config.server.hmr = false;

            // config.optimizeDeps
            if (!config.optimizeDeps) config.optimizeDeps = {};
            config.optimizeDeps.noDiscovery = true;
            if (!config.optimizeDeps.exclude) config.optimizeDeps.exclude = [];
            config.optimizeDeps.exclude.push("@electric-sql/pglite");

            // config.worker
            if (!config.worker) config.worker = {};
            config.worker.format = "es";

            // config.resolve
            if (!config.resolve) config.resolve = {};
            // config.resolve.alias
            config.resolve.alias = {
                ...config.resolve.alias,
            };

            // config.ssr
            config.ssr = {
                noExternal: getNoExternal(),
            };
        },

        configResolved(resolvedConfig) {
            outDir = resolvedConfig.build.outDir || "dist";
        },

        async writeBundle() {
            const filePath = join(cwd(), outDir, ".gitkeep");
            await writeFile(filePath, "", "utf-8");
        },
    } satisfies PluginOption;
}

function getNoExternal() {
    // bun
    const bun = ["bun", /^bun:/];

    // node_modules
    let nodeModules = [...(existsSync(join(cwd(), "node_modules")) ? readdirSync(join(cwd(), "node_modules")) : []), ...(existsSync(join(cwd(), "..", "..", "node_modules")) ? readdirSync(join(cwd(), "..", "..", "node_modules")) : [])].filter((dependency) => !dependency.startsWith("."));
    // electron exclude
    nodeModules = nodeModules.filter((dependency) => dependency !== "electron");
    // startsWith @
    const nodeModulesRegExp = nodeModules.map((dependency) => (dependency.startsWith("@") ? new RegExp(`^${dependency}/`) : dependency));

    return [...bun, ...nodeModulesRegExp];
}

async function getCookbookTomlProject(): Promise<any> {
    const cookbookTomlRaw = await readFile(join(cwd(), "..", "..", "cookbook.toml"), "utf-8");
    const cookbookToml = TOML.parse(cookbookTomlRaw);
    let project: any;
    for (const projectName in cookbookToml.projects as any) {
        // biome-ignore lint/suspicious/noSelfCompare: <explanation>
        if (join(cwd()) !== join(cwd(), "..", projectName)) continue;
        project = (cookbookToml.projects as any)[projectName];
        break;
    }
    if (!project) throw new Error("Project not found in cookbook.toml");
    return project;
}
