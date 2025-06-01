import { Glob } from "bun";
import { join } from "node:path";
import { exists, mkdir, readFile, writeFile } from "node:fs/promises";

export async function drizzleSchema(paths: { cwd: string }) {
  if (!(await exists(join(paths.cwd, "drizzle.config.ts")))) return;
  if (!(await exists(join(paths.cwd, ".milkio")))) await mkdir(join(paths.cwd, ".milkio"));

  const tables = new Glob("{database,module}/**/*.table.ts").scan({
    cwd: join(paths.cwd),
    onlyFiles: true,
  });

  let typescriptImports = "// drizzle-schema";
  for await (let path of tables) {
    path = path.replaceAll("\\", "/");
    const nameWithPath = path.slice(0, path.length - 9); // 9 === ".table.ts".length
    typescriptImports += `\nexport * from "../${nameWithPath}.table";`;
  }
  const typescript = `${typescriptImports}`;

  await writeFile(join(paths.cwd, ".milkio", "drizzle-schema.ts"), typescript);
}
