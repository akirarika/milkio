import consola from "consola";
import { join } from "node:path";
import { defineWatcherExtension } from "../extensions";
import { exists } from "node:fs/promises";
import { getLatestSchemaFolder } from "../../utils/get-latest-schema-folder";

export const routeWatcherExtension = defineWatcherExtension({
    async: false,
    filter: (file) => {
        return file.path.startsWith("modules/") && (file.type === "action" || file.type === "stream");
    },
    setup: async (root, mode, options, project, changeFiles, allFiles) => {
        const milkioTranspiledRouteDirPath = join(root, ".milkio", "transpiled", "routes");
        const milkioGeneratedRouteDirPath = join(root, ".milkio", "generated", "routes");

        let routeSchemaFileImports = "// route-schema";
        let routeSchemaFileExports = "export default {";

        const routePaths: Set<string> = new Set();
        for (const file of allFiles) {
            const hashFile = await getLatestSchemaFolder(join(milkioGeneratedRouteDirPath, file.importName));
            if (!hashFile) continue;
            const hashFileName = `${hashFile}/schema.ts`;
            const transpiledHashFilePath = join(milkioTranspiledRouteDirPath, file.importName, hashFileName);
            if (!(await exists(transpiledHashFilePath))) continue;

            let routePath = file.path.slice(0, file.path.length - 10);
            if (routePath.endsWith("/index") || routePath === "index") routePath = routePath.slice(0, routePath.length - 5);
            if (routePath === "public" && routePath.length > 1) routePath = routePath.slice(0, routePath.length - 1);
            if (routePath.startsWith("modules/")) routePath = `${routePath.slice(8)}`;
            if (routePath !== "/" && routePath.endsWith("/")) routePath = routePath.slice(0, routePath.length - 1);
            if (file.type === "stream") routePath = `${routePath}~`;
            if (routePaths.has(routePath)) {
                consola.error(`Invalid path: "${file.path}". The most common reason for having paths duplicate is that you created a new "${file}" and have a "${file}/index.ts".\n`);
                continue;
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
