import type { CookbookOptions } from "..";
import { join } from "node:path";
import { exit, cwd } from "node:process";
import { exists, mkdir } from "node:fs/promises";
import { routeSchema } from "./route-schema";
import { commandSchema } from "./command-schema";
import { testSchema } from "./test-schema";
import { $ } from "bun";

export const generator = {
  async significant(options: CookbookOptions) {
    const tasks: Array<Promise<void>> = [];
    for (const projectName in options.projects) {
      const project = options.projects[projectName];
      if (project.type !== "milkio") continue;
      const handler = async () => {
        const paths = {
          cwd: join(cwd(), "projects", projectName),
          milkio: join(cwd(), "projects", projectName, ".milkio"),
          generated: join(cwd(), "projects", projectName, ".milkio", "generated"),
        };
        if (!(await exists(paths.milkio))) await mkdir(paths.milkio);
        if (!(await exists(paths.generated))) await mkdir(paths.generated);
        (() => {
          const mode = project?.typiaMode !== "bundler" ? "typia" : "raw";
          let indexFile = "// index";
          indexFile += `\nimport { type MilkioRoutes, routes } from "./${mode}/route-schema.ts";`;
          indexFile += `\nimport commandSchema from "./${mode}/command-schema.ts";`;
          indexFile += `\nimport testSchema from "./${mode}/test-schema.ts";`;
          indexFile += `\nimport type { $rejectCode } from "milkio";`;
          indexFile += "\n";
          indexFile += "\nexport const generated = {";
          indexFile += "\n  rejectCode: undefined as unknown as $rejectCode,";
          indexFile += "\n  routeSchema: { routes: routes, $types: void 0 as unknown as MilkioRoutes },";
          indexFile += "\n  commandSchema,";
          indexFile += "\n  testSchema,";
          indexFile += "\n};";
          Bun.write(join(paths.milkio, "generated", "index.ts"), indexFile);
        })();

        await Promise.all([
          // UwU
          routeSchema(options, paths, project),
          commandSchema(options, paths, project),
          testSchema(options, paths, project),
        ]);
        if (project?.typiaMode !== "bundler") await $`bun x typia generate --input ./.milkio/generated/raw/ --output ./.milkio/generated/typia/ --project ./tsconfig.json`.cwd(join(paths.cwd)).quiet();

        if (project?.significant && project.significant.length > 0) {
          for (const script of project.significant) {
            await $`${{ raw: script }}`.cwd(join(paths.cwd));
          }
        }
      };
      tasks.push(handler());
    }
    await Promise.all(tasks);
  },
  async insignificant(options: CookbookOptions) {
    const tasks: Array<Promise<void>> = [];
    for (const projectName in options.projects) {
      const project = options.projects[projectName];
      if (project.type !== "milkio") continue;
      const handler = async () => {
        const paths = {
          cwd: join(cwd(), "projects", projectName),
          milkio: join(cwd(), "projects", projectName, ".milkio"),
          generated: join(cwd(), "projects", projectName, ".milkio", "generated"),
        };
        if (project?.insignificant && project.insignificant.length > 0) {
          for (const script of project.insignificant) {
            await $`${{ raw: script }}`.cwd(paths.cwd);
          }
        }
      };
      tasks.push(handler());
    }
    await Promise.all(tasks);
  },
};
