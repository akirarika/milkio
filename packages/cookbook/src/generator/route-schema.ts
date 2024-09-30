import { Glob } from "bun";
import consola from "consola";
import { join } from "node:path";
import { exists } from "node:fs/promises";
import type { CookbookOptions } from "..";
import { exit, cwd } from "node:process";
import { checkPath } from "./utils";

export const routeSchema = async (options: CookbookOptions, paths: { cwd: string; milkio: string; generated: string }, project: CookbookOptions["projects"]["key"]) => {
  const scanner = join(paths.cwd, "app");
  let actionFiles: AsyncIterableIterator<string> | Array<string> = [];
  let streamFiles: AsyncIterableIterator<string> | Array<string> = [];
  if (await exists(scanner)) {
    const globAction = new Glob("**/*.action.ts");
    actionFiles = globAction.scan({ cwd: scanner, onlyFiles: true });
    const globStream = new Glob("**/*.stream.ts");
    streamFiles = globStream.scan({ cwd: scanner, onlyFiles: true });
  }

  let typescriptImports = `/* eslint-disable */\n// route-schema`;
  typescriptImports += `\nimport typia, { type IValidation } from "typia";`;
  let typescriptTypeExports = "export type MilkioRoutes = {";
  let typescriptRouteExports = "export const routes = new Map<string, any>([";
  let keys: Array<string> = [];
  // action
  for await (let path of actionFiles) {
    path = path.replaceAll("\\", "/");
    const file = Bun.file(join(scanner, path));
    const fileUnit8Array = await file.text();
    if (!fileUnit8Array.includes("export default action({")) continue;
    checkPath(path, "action");

    let nameWithPath = path.slice(0, path.length - 10); // 10 === ".action.ts".length
    let key = nameWithPath;
    if (key.endsWith("/index") || key === "index") key = key.slice(0, key.length - 5); // 5 === "index".length
    if (key.endsWith("/") && key.length > 1) key = key.slice(0, key.length - 1);
    if (keys.includes(key)) {
      consola.error(`Invalid path: "/app/${path}". The most common reason for having paths duplicate is that you created a new "${path}.action.ts" and have a "${path}/index.action.ts".\n`);
      exit(1);
    }
    keys.push(key);
    const name = path
      .slice(0, path.length - 10) // 10 === ".action".length
      .replaceAll("/", "$")
      .replaceAll("-", "_");
    typescriptTypeExports += `\n  "/${key}": { `;
    typescriptRouteExports += `\n  ["/${key}", { `;
    typescriptRouteExports += `type: "action", `;
    if (project?.lazyRoutes === undefined || project?.lazyRoutes === true) {
      typescriptImports += `\nimport type ${name} from "../../../app/${nameWithPath}.action";`;
      typescriptRouteExports += `module: () => import("../../../app/${nameWithPath}.action"), `;
    } else {
      typescriptImports += `\nimport ${name} from "../../../app/${nameWithPath}.action";`;
      typescriptRouteExports += `module: () => ${name}, `;
    }
    typescriptRouteExports += `validateParams: (params: unknown): IValidation<Parameters<typeof ${name}["handler"]>[1]> => typia.misc.validatePrune<Parameters<typeof ${name}["handler"]>[1]>(params), `;
    typescriptRouteExports += `validateResults: (results: unknown): IValidation<Awaited<ReturnType<typeof ${name}["handler"]>>> => typia.misc.validatePrune<Awaited<ReturnType<typeof ${name}["handler"]>>>(results), `;
    typescriptRouteExports += `"9": void 0 as unknown as boolean `;
    typescriptRouteExports += `}],`;
    typescriptTypeExports += `"🐣": boolean, `;
    typescriptTypeExports += `meta: typeof ${name}["meta"], `;
    typescriptTypeExports += `params: Parameters<typeof ${name}["handler"]>[1], `;
    typescriptTypeExports += `result: Awaited<ReturnType<typeof ${name}["handler"]>> `;
    typescriptTypeExports += `},`;
  }
  // stream
  for await (let path of streamFiles) {
    path = path.replaceAll("\\", "/");
    const file = Bun.file(join(scanner, path));
    const fileUnit8Array = await file.text();
    if (!fileUnit8Array.includes("export default stream({")) continue;
    checkPath(path, "stream");

    let nameWithPath = path.slice(0, path.length - 10); // 10 === ".stream.ts".length
    let key = nameWithPath;
    if (key.endsWith("/index") || key === "index") key = key.slice(0, key.length - 5); // 5 === "index".length
    if (key.endsWith("/") && key.length > 1) key = key.slice(0, key.length - 1);
    if (keys.includes(key)) {
      consola.error(`Invalid path: "/app/${path}". The most common reason for having paths duplicate is that you created a new "${path}.stream.ts" and have a "${path}/index.stream.ts".\n`);
      exit(1);
    }
    keys.push(key);
    const name = path
      .slice(0, path.length - 10) // 10 === ".stream.ts".length
      .replaceAll("/", "$")
      .replaceAll("-", "_")
      .replaceAll(".ts", "");
    typescriptTypeExports += `\n  "/${key}": { `;
    typescriptRouteExports += `\n  ["/${key}", { `;
    typescriptRouteExports += `type: "stream", `;
    if (project?.lazyRoutes === undefined || project.lazyRoutes === true) {
      typescriptImports += `\nimport type ${name} from "../../../app/${nameWithPath}.stream";`;
      typescriptRouteExports += `module: () => import("../../../app/${nameWithPath}.stream"), `;
    } else {
      typescriptImports += `\nimport ${name} from "../../../app/${nameWithPath}.stream";`;
      typescriptRouteExports += `module: () => ${name}, `;
    }
    typescriptRouteExports += `validateParams: (params: unknown): IValidation<Parameters<typeof ${name}["handler"]>[1]> => typia.misc.validatePrune<Parameters<typeof ${name}["handler"]>[1]>(params), `;
    typescriptRouteExports += `validateResults: (results: unknown): IValidation<Awaited<ReturnType<typeof ${name}["handler"]>>> => typia.misc.validatePrune<Awaited<ReturnType<typeof ${name}["handler"]>>>(results), `;
    typescriptRouteExports += `"9": void 0 as unknown as number `;
    typescriptRouteExports += `}],`;
    typescriptTypeExports += `"🐣": number, `;
    typescriptTypeExports += `meta: typeof ${name}["meta"], `;
    typescriptTypeExports += `params: Parameters<typeof ${name}["handler"]>[1], `;
    typescriptTypeExports += `result: Awaited<ReturnType<typeof ${name}["handler"]>> `;
    typescriptTypeExports += `},`;
  }
  typescriptTypeExports += "\n}";
  typescriptRouteExports += "\n]);";
  const typescript = `${typescriptImports}\n\n${typescriptTypeExports}\n\n${typescriptRouteExports}`;
  await Bun.write(join(paths.cwd, ".milkio", "generated", "raw", "route-schema.ts"), typescript);
};
