import { join, dirname } from "node:path";
import { exists, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";

// typia 14 移除了 CLI（lib/executable/typia.js），transform 只能通过 ttsc 的
// TtscCompiler.transform() 编程接口完成。但 TtscCompiler 在 Bun（Windows）下会触发
// Bun 的 fs fd bug（"Internal error: directory mismatch ... fd ..."），拿不到输出，
// 因此必须在 Node 子进程中执行。helper 脚本在运行时写入 .milkio/.tmp 目录，
// 源码运行与 bun --compile 打包（co.exe）两种形态都可用。
//
// 前置要求：
//   1. 项目安装了 ttsc（版本由 check-versions 保证与 co 一致）
//   2. 机器上有 Node.js
//   3. 机器上有 Go 工具链（ttsc 需构建 typia 的 Go 插件 native/cmd/ttsc-typia，
//      构建产物缓存于 node_modules/.cache/ttsc，只构建一次）

const HELPER_SOURCE = `
const { createRequire } = require("node:module");
const { join, dirname } = require("node:path");
const fs = require("node:fs");
const args = process.argv.slice(2);
function arg(name) { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; }
const root = arg("--root");
const tsconfig = arg("--tsconfig");
const schema = arg("--schema");
const out = arg("--out");
try {
  const req = createRequire(join(root, "package.json"));
  const { TtscCompiler } = req("ttsc");
  const result = new TtscCompiler({ cwd: root, tsconfig }).transform();
  const ts = result && result.typescript;
  const target = schema.split(String.fromCharCode(92)).join("/");
  let content;
  if (ts && typeof ts === "object") {
    for (const entry of Object.entries(ts)) {
      if (entry[0].split(String.fromCharCode(92)).join("/") === target) { content = entry[1]; break; }
    }
    if (content === undefined) {
      for (const entry of Object.entries(ts)) {
        const key = entry[0].split(String.fromCharCode(92)).join("/");
        if (key === "schema.ts" || key.endsWith("/schema.ts")) { content = entry[1]; break; }
      }
    }
  }
  if (content === undefined) {
    const diags = Array.isArray(result && result.diagnostics) ? result.diagnostics : [];
    const text = diags.map((d) => (typeof (d && d.messageText) === "string" ? d.messageText : d && d.messageText && d.messageText.messageText) || (d && d.message) || JSON.stringify(d)).join("\\n");
    process.stderr.write(text || (result && result.error && result.error.message) || ("no transformed output for " + schema));
    process.exit(1);
  }
  fs.mkdirSync(dirname(out), { recursive: true });
  fs.writeFileSync(out, content, "utf8");
} catch (e) {
  process.stderr.write((e && e.message) || String(e));
  process.exit(1);
}
`;

async function ensureHelper(root: string): Promise<string> {
  const dir = join(root, ".milkio", ".tmp");
  const helperPath = join(dir, "ttsc-transform.cjs");
  await mkdir(dir, { recursive: true });
  const existing = await exists(helperPath) ? await readFile(helperPath, "utf-8") : null;
  if (existing !== HELPER_SOURCE) await writeFile(helperPath, HELPER_SOURCE, "utf-8");
  return helperPath;
}

export type TypiaTransformResult = { ok: true } | { ok: false; error: string };

// 对单个生成的 schema.ts 执行 typia transform，结果直接写入 outPath。
// 等同于 typia 13 的 `typia generate --input <dir> --output <dir>`。
export async function runTypiaTransform(params: {
  root: string;
  tsconfigPath: string;
  schemaFilePath: string;
  outPath: string;
}): Promise<TypiaTransformResult> {
  const { root, tsconfigPath, schemaFilePath, outPath } = params;
  try {
    const helperPath = await ensureHelper(root);
    await rm(outPath, { force: true }).catch(() => {});

    await new Promise<void>((resolve, reject) => {
      const child = execFile(
        "node",
        [helperPath, "--root", root, "--tsconfig", tsconfigPath, "--schema", schemaFilePath, "--out", outPath],
        { cwd: root, maxBuffer: 64 * 1024 * 1024, timeout: 180_000, windowsHide: true },
        (error, _stdout, stderr) => {
          if (error) reject(new Error(stderr || error.message));
          else resolve();
        },
      );
      const forceTimer = setTimeout(() => child.kill("SIGKILL"), 180_000 + 10_000);
      child.on("close", () => clearTimeout(forceTimer));
    });

    if (!(await exists(outPath))) {
      return { ok: false, error: `no transformed output for ${schemaFilePath}` };
    }
    const content = await readFile(outPath, "utf-8");
    if (content.length === 0) {
      return { ok: false, error: `empty transformed output for ${schemaFilePath}` };
    }
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message ?? String(error) };
  }
}
