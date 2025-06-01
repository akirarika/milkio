import { $, Glob } from "bun";
import consola from "consola";
import { join } from "node:path";
import { exists, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { exit } from "node:process";
import type { CookbookOptions } from "../utils/cookbook-dto-types";
import { checkPath } from "./utils";
import { calcHash } from "../utils/calc-hash";
import { getRate } from "../progress";
import { unlinkIfTooLong } from "../utils/unlink-if-too-long";
import { getRuntime } from "../utils/get-runtime";
import { getTypiaPath } from "../utils/get-typia-path";

export async function routeSchema(options: CookbookOptions, paths: { cwd: string; milkio: string; generated: string }, project: CookbookOptions["projects"]["key"]) {
  if (!paths.milkio) return;

  const milkioRawPath = join(paths.cwd, ".milkio", "raw");
  const milkioRawRoutesPath = join(milkioRawPath, "routes");
  if (!(await exists(milkioRawPath))) await mkdir(milkioRawPath);
  if (!(await exists(milkioRawRoutesPath))) await mkdir(milkioRawRoutesPath);

  const scanner = join(paths.cwd);
  if (!(await exists(scanner))) {
    consola.error(`The directory does not exist: ${scanner}`);
    exit(1);
  }
  const glob = new Glob("{controller,module}/**/*.{action,stream}.ts");
  const filesAsyncGenerator = glob.scan({ cwd: scanner, onlyFiles: true });
  const files: Array<string> = [];
  let changeType: "file-change" | "file-create-or-delete" | null = null;

  /**
   * ------------------------------------------------------------------------------------------------
   * @step generate node
   * ------------------------------------------------------------------------------------------------
   */
  const nodeHandler = async () => {
    if (!(await exists(join(paths.milkio, "run.ts")))) {
      await writeFile(
        join(paths.milkio, "run.ts"),
        `#!/usr/bin/env node
import * as http from "node:http";
import { createRequestListener } from "@mjackson/node-fetch-server";
import { create } from "../index.ts";
import { env } from "node:process";

async function bootstrap() {
  const world = await create({
    develop: env.MILKIO_DEVELOP === "ENABLE",
    argv: process.argv,
  });

  function handler(request: Request) {
    return world.listener.fetch({
      request,
      env,
      envMode: env.MILKIO_DEVELOP === "ENABLE" ? "development" : "production",
    });
  }

  const server = http.createServer(createRequestListener(handler));
  server.listen(world.listener.port);
}

void bootstrap();`,
      );
    }
  };

  /**
   * ------------------------------------------------------------------------------------------------
   * @step generate bun
   * ------------------------------------------------------------------------------------------------
   */
  const bunHandler = async () => {
    if (!(await exists(join(paths.milkio, "run.ts")))) {
      writeFile(
        join(paths.milkio, "run.ts"),
        `#!/usr/bin/env bun
import { create } from "../index.ts";
import { env } from "bun";

async function bootstrap() {
  const world = await create({
    develop: env.MILKIO_DEVELOP === "ENABLE",
    argv: process.argv,
  });
  Bun.serve({
    port: world.listener.port,
    async fetch(request) {
      return world.listener.fetch({
        request,
        env,
        envMode: env.MILKIO_DEVELOP === "ENABLE" ? "development" : "production",
      });
    },
  });
}

void bootstrap();`,
      );
    }
  };

  if (project?.runtime === undefined || project?.runtime === "node") {
    await nodeHandler();
  } else if (project.runtime === "bun") {
    await bunHandler();
  }

  const tasks: Array<Promise<any>> = [];

  /**
   * ------------------------------------------------------------------------------------------------
   * @step scan files & generate routes
   * ------------------------------------------------------------------------------------------------
   */
  const hashes: Map<string, { importName: string; fileHash: string }> = new Map();

  for await (const fileRaw of filesAsyncGenerator) {
    const file = fileRaw.replaceAll("\\", "/");
    files.push(file);
    const runner = async () => {
      const fileHash = calcHash(await readFile(join(scanner, file)));
      const type = file.endsWith(".stream.ts") ? "stream" : "action";
      checkPath(paths, file, type);
      const importName = file
        .slice(0, file.length - 10) // 10 === ".stream.ts".length && 10 === ".action.ts".length
        .replaceAll("/", "__")
        .replaceAll("-", "_");
      const routeSchemaFolderPath = join(paths.cwd, ".milkio", "raw", "routes", `${importName}`);
      const routeGeneratedSchemaFolderPath = join(paths.cwd, ".milkio", "generated", "routes", `${importName}`);
      const routeSchemaPath = join(paths.cwd, ".milkio", "raw", "routes", `${importName}`, `${fileHash}.ts`);
      const routeSchemaGeneratedPath = join(paths.cwd, ".milkio", "generated", "routes", `${importName}`, `${fileHash}.ts`);
      hashes.set(file, { importName, fileHash });
      if (!(await exists(routeSchemaFolderPath))) {
        await mkdir(routeSchemaFolderPath);
        changeType = "file-create-or-delete";
      }

      const rules: Array<Promise<boolean>> = [];
      rules.push(exists(routeSchemaPath));
      rules.push(exists(routeSchemaGeneratedPath));
      if ((await Promise.all(rules)).filter((bool) => bool === true).length !== rules.length) {
        if (changeType !== "file-create-or-delete") changeType = "file-change";

        let routeFileImports = "// route-schema";
        routeFileImports += `\nimport typia, { type IValidation } from "typia";`;
        routeFileImports += `\nimport { TSON, type TSONEncode } from "@southern-aurora/tson";`;
        let routeFileExports = "export default { ";
        routeFileExports += `type: "${type}", `;
        routeFileExports += "types: undefined as any as { ";
        routeFileExports += `"🐣": ${type === "action" ? "boolean" : "number"}, `;
        routeFileExports += `meta: typeof ${importName}["meta"], `;
        routeFileExports += `params: Parameters<typeof ${importName}["handler"]>[1], `;
        routeFileExports += `result: Awaited<ReturnType<typeof ${importName}["handler"]>> `;
        routeFileExports += "},";
        if (project?.lazyRoutes === undefined || project?.lazyRoutes === true) {
          routeFileImports += `\nimport type ${importName} from "../../../../${file}";`;
          routeFileExports += `module: () => import("../../../../${file}"), `;
        } else {
          routeFileImports += `\nimport ${importName} from "../../../../${file}";`;
          routeFileExports += `module: () => ${importName}, `;
        }
        routeFileExports += `validateParams: (params: any): IValidation<Parameters<typeof ${importName}["handler"]>[1]> => typia.misc.validatePrune<Parameters<typeof ${importName}["handler"]>[1]>(params) as any, `;
        routeFileExports += `randomParams: (): IValidation<Parameters<typeof ${importName}["handler"]>[1]> => typia.random<Parameters<typeof ${importName}["handler"]>[1]>() as any, `;
        routeFileExports += `validateResults: (results: any): IValidation<Awaited<ReturnType<typeof ${importName}["handler"]>>> => typia.misc.validatePrune<Awaited<ReturnType<typeof ${importName}["handler"]>>>(results) as any, `;
        routeFileExports += `resultsToJSON: (results: any): Awaited<ReturnType<typeof ${importName}["handler"]>> => typia.json.stringify<TSONEncode<Awaited<ReturnType<typeof ${importName}["handler"]>>>>(TSON.encode(results)) as any, `;
        routeFileExports += "};";

        const oldFiles = await readdir(routeSchemaFolderPath);
        await writeFile(routeSchemaPath, `${routeFileImports}\n\n${routeFileExports}`);

        const deleteTasks: Array<Promise<any>> = [];
        for (const oldFile of oldFiles) {
          const oldFilePath = join(paths.cwd, ".milkio", "raw", "routes", `${importName}`, oldFile);
          const oldFileGeneratedPath = join(paths.cwd, ".milkio", "generated", "routes", `${importName}`, oldFile);
          if (await exists(oldFilePath)) deleteTasks.push(unlinkIfTooLong(oldFilePath));
          if (await exists(oldFileGeneratedPath)) deleteTasks.push(unlinkIfTooLong(oldFileGeneratedPath));
        }
        await Promise.all(deleteTasks);

        /**
         * ------------------------------------------------------------------------------------------------
         * @step scan files & generate routes: Typia
         * ------------------------------------------------------------------------------------------------
         */
        if (project?.typiaMode !== "bundler") {
          await $`${await getRuntime()} ${await getTypiaPath()} generate --input ${routeSchemaFolderPath} --output ${routeGeneratedSchemaFolderPath} --project ${join(paths.cwd, "tsconfig.json")}`.cwd(join(paths.cwd)).quiet();
        }

        consola.info(`[${getRate()}] route schema generated: ${file}`);
      }
    };
    tasks.push(runner());
  }
  await Promise.all(tasks);

  /**
   * ------------------------------------------------------------------------------------------------
   * @step generate route-schema.ts
   * ------------------------------------------------------------------------------------------------
   */
  if (changeType) {
    const routeSchemaPath = join(paths.cwd, ".milkio", "route-schema.ts");

    let routeSchemaFileImports = "// route-schema";
    let routeSchemaFileExports = "export default {";

    const routePaths: Array<string> = [];
    for await (const file of files) {
      let { importName, fileHash } = hashes.get(file) ?? {};

      let routePath = file.slice(0, file.length - 10); // 10 === ".stream.ts".length && 10 === ".action.ts".length
      if (routePath.endsWith("/index") || routePath === "index") routePath = routePath.slice(0, routePath.length - 5); // 5 === "index".length
      if (routePath === "public" && routePath.length > 1) routePath = routePath.slice(0, routePath.length - 1);
      if (routePaths.includes(routePath)) {
        consola.error(`Invalid path: "${join(paths.cwd, "public", file)}". The most common reason for having paths duplicate is that you created a new "${file}" and have a "${file}/index.ts".\n`);
        exit(1);
      }
      routePath = routePath.split(".")[0];
      if (routePath.startsWith("controller/")) routePath = routePath.slice(11); // 11 === "controller/".length
      if (routePath.startsWith("module/")) routePath = `_${routePath.slice(7)}`; // 7 === "module".length
      if (routePath !== "/" && routePath.endsWith("/")) routePath = routePath.slice(0, routePath.length - 1);
      routePaths.push(routePath);

      if (!importName) {
        importName = file
          .slice(0, file.length - 10) // 10 === ".ts".length
          .replaceAll("/", "__")
          .replaceAll("-", "_");
      }
      if (!fileHash) {
        try {
          fileHash = (await readdir(join(paths.cwd, ".milkio", "raw", "routes", `${importName}`)))[0].slice(0, -3); // 3 === ".ts".length
        } catch (error) {
          consola.error(`Generation failed, cache file is incomplete, please manually delete your ${join(paths.cwd, ".milkio")} directory and try again.`);
          exit(1);
        }
      }

      if (project?.typiaMode !== "bundler") routeSchemaFileImports += `\nimport ${importName} from "./generated/routes/${importName}/${fileHash}.ts";`;
      else routeSchemaFileImports += `\nimport ${importName} from "./raw/routes/${importName}/${fileHash}.ts";`;
      routeSchemaFileExports += `\n  "/${routePath}": ${importName},`;
    }
    routeSchemaFileExports += "\n};";

    await writeFile(routeSchemaPath, `${routeSchemaFileImports}\n\n${routeSchemaFileExports}`);
  }
}
