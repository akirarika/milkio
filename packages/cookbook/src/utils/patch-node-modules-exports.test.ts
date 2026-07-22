import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureTypiaExportsPatched } from "./patch-typia-exports.ts";
import { ensureEstreeWalkerExportsPatched } from "./patch-estree-walker-exports.ts";
import { ensureNodeModulesExportsPatched } from "./patch-node-modules-exports.ts";

// 上游包 exports 缺陷补丁的单元测试：
// - typia@13.1.1 的 "./lib/internal/*" 通配把 X.js 映射到 X.js.mjs，ESM 导入崩溃
// - estree-walker@3.0.3 的 exports 只有 import 条件，CJS require 抛 No "exports" main defined
// 两个补丁都必须：有缺陷 → 修复；已修复/无缺陷 → 不动；文件缺失 → 不抛错

let workDir = "";

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "cookbook-patch-test-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

async function writePackageJson(relativePath: string, content: unknown): Promise<string> {
  const filePath = join(workDir, relativePath);
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, JSON.stringify(content, null, 2), "utf-8");
  return filePath;
}

async function readPackageJson(filePath: string): Promise<any> {
  return JSON.parse(await readFile(filePath, "utf-8"));
}

const buggyTypia = {
  name: "typia",
  version: "13.1.1",
  exports: {
    ".": { types: "./index.d.ts", import: "./index.mjs" },
    "./lib/internal/*.js": { types: "./lib/internal/*.d.ts", import: "./lib/internal/*.mjs" },
    "./lib/internal/*": { types: "./lib/internal/*.d.ts", import: "./lib/internal/*.mjs" },
  },
};

const buggyEstreeWalker = {
  name: "estree-walker",
  version: "3.0.3",
  exports: {
    ".": {
      types: "./types/index.d.ts",
      import: "./src/index.js",
    },
  },
};

test("typia: buggy exports are patched with explicit *.js entry before wildcard", async () => {
  const filePath = await writePackageJson("node_modules/typia/package.json", buggyTypia);

  await ensureTypiaExportsPatched(workDir);

  const patched = await readPackageJson(filePath);
  const keys = Object.keys(patched.exports);
  expect(keys).toEqual([".", "./lib/internal/*.js", "./lib/internal/*"]);
  expect(patched.exports["./lib/internal/*.js"]).toEqual({
    types: "./lib/internal/*.d.ts",
    import: "./lib/internal/*.mjs",
  });
});

test("typia: already patched exports are left untouched (idempotent)", async () => {
  const filePath = await writePackageJson("node_modules/typia/package.json", buggyTypia);

  await ensureTypiaExportsPatched(workDir);
  const afterFirst = await readFile(filePath, "utf-8");
  await ensureTypiaExportsPatched(workDir);
  const afterSecond = await readFile(filePath, "utf-8");

  expect(afterSecond).toBe(afterFirst);
});

test("typia: exports without the wildcard entry are left untouched", async () => {
  const healthy = {
    name: "typia",
    version: "99.0.0",
    exports: { ".": { import: "./index.mjs" } },
  };
  const filePath = await writePackageJson("node_modules/typia/package.json", healthy);

  await ensureTypiaExportsPatched(workDir);

  expect(await readPackageJson(filePath)).toEqual(healthy);
});

test("typia: missing package.json does not throw", async () => {
  await expect(ensureTypiaExportsPatched(workDir)).resolves.toBeUndefined();
});

test("estree-walker: buggy exports gain a default condition right after import", async () => {
  const filePath = await writePackageJson("node_modules/estree-walker/package.json", buggyEstreeWalker);

  await ensureEstreeWalkerExportsPatched(workDir);

  const patched = await readPackageJson(filePath);
  const keys = Object.keys(patched.exports["."]);
  expect(keys).toEqual(["types", "import", "default"]);
  expect(patched.exports["."].default).toBe("./src/index.js");
});

test("estree-walker: nested copies (plain and scoped) are patched too", async () => {
  const plainNested = await writePackageJson("node_modules/unimport/node_modules/estree-walker/package.json", buggyEstreeWalker);
  const scopedNested = await writePackageJson("node_modules/@vitest/mocker/node_modules/estree-walker/package.json", buggyEstreeWalker);

  await ensureEstreeWalkerExportsPatched(workDir);

  expect((await readPackageJson(plainNested)).exports["."].default).toBe("./src/index.js");
  expect((await readPackageJson(scopedNested)).exports["."].default).toBe("./src/index.js");
});

test("estree-walker: copies with require or default condition are left untouched", async () => {
  const healthy2x = {
    name: "estree-walker",
    version: "2.0.2",
    exports: {
      ".": {
        types: "./types/index.d.ts",
        require: "./dist/estree-walker.umd.js",
        import: "./dist/estree-walker.js",
      },
    },
  };
  const filePath = await writePackageJson("node_modules/estree-walker/package.json", healthy2x);

  await ensureEstreeWalkerExportsPatched(workDir);

  expect(await readPackageJson(filePath)).toEqual(healthy2x);
});

test("estree-walker: already patched copies are left untouched (idempotent)", async () => {
  const filePath = await writePackageJson("node_modules/estree-walker/package.json", buggyEstreeWalker);

  await ensureEstreeWalkerExportsPatched(workDir);
  const afterFirst = await readFile(filePath, "utf-8");
  await ensureEstreeWalkerExportsPatched(workDir);
  const afterSecond = await readFile(filePath, "utf-8");

  expect(afterSecond).toBe(afterFirst);
});

test("estree-walker: missing node_modules does not throw", async () => {
  await expect(ensureEstreeWalkerExportsPatched(workDir)).resolves.toBeUndefined();
});

test("combined entry patches both packages", async () => {
  const typiaPath = await writePackageJson("node_modules/typia/package.json", buggyTypia);
  const walkerPath = await writePackageJson("node_modules/estree-walker/package.json", buggyEstreeWalker);

  await ensureNodeModulesExportsPatched(workDir);

  expect(Object.keys((await readPackageJson(typiaPath)).exports)).toEqual([".", "./lib/internal/*.js", "./lib/internal/*"]);
  expect((await readPackageJson(walkerPath)).exports["."].default).toBe("./src/index.js");
});
