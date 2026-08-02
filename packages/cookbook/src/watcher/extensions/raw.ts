import consola from "consola";
import { join } from "node:path";
import { defineWatcherExtension } from "../extensions";

/**
 * Raw schema generator.
 *
 * Unlike action/stream routes, raw routes are NOT merged into route-schema.ts
 * (which feeds stargate's type system). Raw routes bypass stargate entirely —
 * they receive a native Request and return a native Response, so stargate
 * cannot (and should not) call them.
 *
 * Instead, this extension generates a separate `.milkio/raw-schema.ts` that
 * exports:
 *   - `rawPaths`: a Set<string> for O(1) path lookup in the listener
 *   - `routes`: a Record<string, { type: "raw"; module: () => Promise<...> }>
 *
 * No typia validation is generated — raw handlers own the full request/response
 * lifecycle and are responsible for their own input handling.
 */
export const rawWatcherExtension = defineWatcherExtension({
    async: false,
    filter: (file) => {
        return file.path.startsWith("modules/") && file.type === "raw";
    },
    setup: async (root, mode, options, project, changeFiles, allFiles) => {
        let rawSchemaFileHeader = "// raw-schema";
        let rawSchemaFileExports = "const rawPaths = new Set<string>([";
        let rawSchemaFileRoutes = "const routes: Record<string, { type: \"raw\"; module: () => Promise<any> }> = {";

        const routePaths: Set<string> = new Set();
        for (const file of allFiles) {
            let routePath = file.path.slice(0, file.path.length - 7); // 去掉 .raw.ts (7 字符)
            if (routePath.endsWith("/index") || routePath === "index") routePath = routePath.slice(0, routePath.length - 5);
            if (routePath === "public" && routePath.length > 1) routePath = routePath.slice(0, routePath.length - 1);
            if (routePath.startsWith("modules/")) routePath = `${routePath.slice(8)}`;
            if (routePath !== "/" && routePath.endsWith("/")) routePath = routePath.slice(0, routePath.length - 1);
            if (routePaths.has(routePath)) {
                consola.error(`Invalid path: "${file.path}". The most common reason for having paths duplicate is that you created a new "${file}" and have a "${file}/index.ts".\n`);
                continue;
            }
            routePaths.add(routePath);

            const routeKey = `/${routePath}`;
            rawSchemaFileExports += `\n  "${routeKey}",`;
            rawSchemaFileRoutes += `\n  "${routeKey}": { type: "raw", module: () => import("../app/${file.path}") },`;
        }
        rawSchemaFileExports += "\n]);";
        rawSchemaFileRoutes += "\n};";

        const writePath = join(root, ".milkio", "raw-schema.ts");

        // 与 route-schema.ts 保持一致：使用 default export，由 .milkio/index.ts
        // 通过 `import rawSchema from "./raw-schema.ts"` 引入。若使用 named export，
        // 默认导入会拿到 undefined，导致 listener 中 generated.rawSchema 为空。
        const newRawSchemaContent = `${rawSchemaFileHeader}\n\n${rawSchemaFileExports}\n\n${rawSchemaFileRoutes}\n\nexport default { rawPaths, routes };\n`;
        // 比较内容，相同则跳过写入，避免触发 vite page reload
        let oldRawSchemaContent: string | null = null;
        try { oldRawSchemaContent = await Bun.file(writePath).text(); } catch {}
        if (oldRawSchemaContent !== newRawSchemaContent) {
            await Bun.write(writePath, newRawSchemaContent);
        }
    },
});
