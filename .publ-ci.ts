import { join } from "node:path";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { rolldown } from "rolldown";

const cwd = process.cwd();
const DRY_RUN = process.env.DRY_RUN === "1";

const mainPackage = "milkio";
const childPackages = [
  "cookbook",
  "create-cookbook",
  "milkio-electron",
  "cookbook-command",
  "milkio-astra",
  "milkio-drizzle",
  "milkio-redis",
  "milkio-stargate",
  "milkio-stargate-worker",
  "vite-plugin-milkio",
  "template-milkio",
  "template-cookbook",
];

type PkgJson = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  repository?: any;
  license?: string;
  homepage?: string;
};

function readJson<T>(p: string): T {
  return JSON.parse(readFileSync(p, "utf-8")) as T;
}

function writeJson(p: string, data: any) {
  writeFileSync(p, JSON.stringify(data, null, 2));
}

function getRepoVersion(): string {
  const pj = readJson<{ version: string }>(join(cwd, "packages", mainPackage, "package.json"));
  return pj.version;
}

function getNpmTag(version: string): "" | "rc" | "beta" | "alpha" {
  if (version.includes("-rc.")) return "rc";
  if (version.includes("-beta.")) return "beta";
  if (version.includes("-alpha.")) return "alpha";
  return "";
}

function npmCmd(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function isWin32Cmd(cmd: string): boolean {
  return process.platform === "win32" && /\.(cmd|bat)$/i.test(cmd);
}

function run(cmd: string, args: string[], opts?: { cwd?: string; env?: Record<string, string> }) {
  const result = spawnSync(cmd, args, {
    cwd: opts?.cwd ?? cwd,
    env: { ...process.env, ...opts?.env },
    stdio: "inherit",
    shell: isWin32Cmd(cmd),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")} (exit code ${result.status})`);
  }
}

function npmViewExists(pkgName: string, version: string): boolean {
  if (DRY_RUN) return false;
  const result = spawnSync(npmCmd(), ["view", `${pkgName}@${version}`, "--json"], {
    cwd,
    env: { ...process.env },
    stdio: "ignore",
    shell: isWin32Cmd(npmCmd()),
  });
  return result.status === 0;
}

function npmPublish(dir: string, npmTag: string) {
  if (DRY_RUN) {
    console.log(`[dry-run] npm publish skipped for ${dir}`);
    return;
  }
  const args = ["publish", "--access", "public"];
  if (npmTag) args.push("--tag", npmTag);
  run(npmCmd(), args, { cwd: dir });
}

function ensureDir(p: string) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function copyLicenseTo(dir: string) {
  const licensePath = join(cwd, "LICENSE");
  if (!existsSync(licensePath)) return;
  writeFileSync(join(dir, "LICENSE"), readFileSync(licensePath, "utf-8"));
}

function normalizeRepository(repo: any) {
  const DEFAULT_REPO = { type: "git", url: "https://github.com/akirarika/milkio" };

  if (repo == null) return DEFAULT_REPO;
  if (typeof repo === "string") return repo || DEFAULT_REPO.url;

  return {
    type: repo.type ?? DEFAULT_REPO.type,
    url: repo.url || DEFAULT_REPO.url,
  };
}

function writeDistPackageJson(pkgDir: string, outDir: string) {
  const src = readJson<PkgJson>(join(pkgDir, "package.json"));

  const out: any = {
    name: src.name,
    version: src.version,
    type: "module",
    exports: "./index.js",
    types: "./index.d.ts",
    dependencies: {},
    repository: normalizeRepository(src.repository),
    license: src.license,
    homepage: src.homepage,
  };

  // vite-plugin-milkio：保留依赖
  if (pkgDir.endsWith(join("packages", "vite-plugin-milkio"))) {
    const deps = src.dependencies ?? {};
    if (deps["vite-plugin-node"]) out.dependencies["vite-plugin-node"] = deps["vite-plugin-node"];
    if (deps["@mjackson/node-fetch-server"])
      out.dependencies["@mjackson/node-fetch-server"] = deps["@mjackson/node-fetch-server"];
    out.peerDependencies = { vite: ">=5" };
  }

  // 保留对其它 @milkio/* 包的依赖（如 @milkio/astra 依赖 @milkio/drizzle），
  // 并把 workspace:* 解析为当前发布版本号，保证安装时能拉到对应版本。
  const srcDeps = src.dependencies ?? {};
  for (const depName in srcDeps) {
    if (!depName.startsWith("@milkio/")) continue;
    out.dependencies[depName] = src.version;
  }

  const outPath = join(outDir, "package.json");
  writeJson(outPath, out);
  const raw = readFileSync(outPath, "utf-8");
  if (!raw.trim()) throw new Error(`dist/package.json is empty: ${outPath}`);
  JSON.parse(raw);
}

// Replaces the previous Bun.build call: Rolldown is the bundler used by Vite 8
// / Vite+, and the previous build inlined every dependency except the explicit
// externals. Rolldown's default (without an external list) does the same, while
// node builtins stay external because of `platform: "node"`.
async function buildDist(pkgName: string) {
  const pkgDir = join(cwd, "packages", pkgName);
  const outDir = join(pkgDir, "dist");

  rmSync(outDir, { recursive: true, force: true });
  ensureDir(outDir);

  const external: string[] = [];
  if (pkgName === "vite-plugin-milkio")
    external.push("vite", "vite-plugin-node", "@mjackson/node-fetch-server");

  const bundle = await rolldown({
    input: join(pkgDir, "index.ts"),
    platform: "node",
    external: external.length > 0 ? external : undefined,
  });
  await bundle.write({
    dir: outDir,
    format: "esm",
    sourcemap: "inline",
    minify: false,
    entryFileNames: "index.js",
    chunkFileNames: "[name]-[hash].js",
  });
  await bundle.close();

  // d.ts
  run(
    process.execPath,
    [
      join(cwd, "node_modules", "typescript", "bin", "tsc"),
      "index.ts",
      "--declaration",
      "--emitDeclarationOnly",
      "--outDir",
      "./dist",
      "--module",
      "nodenext",
      "--moduleResolution",
      "nodenext",
      "--allowImportingTsExtensions",
      "--ignoreConfig",
      "--lib",
      "ESNext,DOM",
      "--types",
      "node",
    ],
    { cwd: pkgDir },
  );

  if (!existsSync(join(outDir, "index.d.ts"))) {
    throw new Error(`d.ts generation failed for ${pkgName}: index.d.ts not found in dist`);
  }

  copyLicenseTo(outDir);
  writeDistPackageJson(pkgDir, outDir);
}

async function publishDistPackages(version: string, npmTag: string) {
  for (const pkg of [mainPackage, ...childPackages]) {
    if (
      pkg.startsWith("template-") ||
      pkg === "cookbook" ||
      pkg === "create-cookbook" ||
      pkg === "milkio-electron"
    ) {
      continue;
    }

    const pkgDir = join(cwd, "packages", pkg);
    const pj = readJson<PkgJson>(join(pkgDir, "package.json"));

    if (npmViewExists(pj.name, version)) {
      console.log(`${pj.name}@${version} already exists, skipping publish`);
      continue;
    }

    console.log(`Building ${pj.name}@${version}...`);
    await buildDist(pkg);

    console.log(`Publishing ${pj.name}@${version} (dist)...`);
    npmPublish(join(pkgDir, "dist"), npmTag);
  }
}

function publishTemplatePackages(version: string, npmTag: string) {
  for (const pkg of childPackages) {
    if (!pkg.startsWith("template-")) continue;

    const pkgDir = join(cwd, "packages", pkg);
    const pj = readJson<PkgJson>(join(pkgDir, "package.json"));

    if (npmViewExists(pj.name, version)) {
      console.log(`${pj.name}@${version} already exists, skipping publish`);
      continue;
    }

    console.log(`Publishing ${pj.name}@${version} (template root)...`);
    npmPublish(pkgDir, npmTag);
  }
}

function publishDirectPackages(version: string, npmTag: string) {
  const direct = ["create-cookbook", "milkio-electron"];

  for (const pkg of direct) {
    const pkgDir = join(cwd, "packages", pkg);
    const pj = readJson<PkgJson>(join(pkgDir, "package.json"));

    if (npmViewExists(pj.name, version)) {
      console.log(`${pj.name}@${version} already exists, skipping publish`);
      continue;
    }

    const distDir = join(pkgDir, "dist");
    ensureDir(distDir);
    copyLicenseTo(distDir);

    console.log(`Publishing ${pj.name}@${version} (direct root)...`);
    npmPublish(pkgDir, npmTag);
  }
}

// Builds every published platform binary with Vite+ (`vp pack` -> tsdown's
// experimental `exe` option -> Node.js single executable application).
// tsdown cross-compiles by downloading the matching Node.js binary.
const cookbookBinaries = [
  { platform: "darwin", arch: "arm64", built: "co-darwin-arm64", exeName: "co" },
  { platform: "darwin", arch: "x64", built: "co-darwin-x64", exeName: "co" },
  { platform: "linux", arch: "arm64", built: "co-linux-arm64", exeName: "co" },
  { platform: "linux", arch: "x64", built: "co-linux-x64", exeName: "co" },
  { platform: "win32", arch: "x64", built: "co-win-x64.exe", exeName: "co.exe" },
];

function buildCookbookBinaries() {
  const buildDir = join(cwd, "packages", "cookbook", "build");
  rmSync(buildDir, { recursive: true, force: true });

  console.log("Building cookbook binaries (Node SEA) for all platforms...");
  run(process.execPath, [join(cwd, "node_modules", "vite-plus", "bin", "vp"), "-C", "packages/cookbook", "pack"], {
    env: { ...process.env, COOKBOOK_EXE_TARGETS: "all" },
  });
}

function publishCookbookBinaries(version: string, npmTag: string) {
  const repo = normalizeRepository(
    readJson<PkgJson>(join(cwd, "packages", mainPackage, "package.json")).repository,
  );

  const cookbookDistRoot = join(cwd, "packages", "cookbook", "dist");
  ensureDir(cookbookDistRoot);

  const missing = cookbookBinaries.filter(
    (target) => !npmViewExists(`@milkio/cookbook-${target.platform}-${target.arch}`, version),
  );
  if (missing.length > 0) {
    buildCookbookBinaries();
  }

  for (const t of cookbookBinaries) {
    const pkgName = `@milkio/cookbook-${t.platform}-${t.arch}`;

    if (npmViewExists(pkgName, version)) {
      console.log(`${pkgName}@${version} already exists, skipping publish`);
      continue;
    }

    const outDir = join(cookbookDistRoot, `cookbook-${t.platform}-${t.arch}`);
    rmSync(outDir, { recursive: true, force: true });
    ensureDir(outDir);

    const builtPath = join(cwd, "packages", "cookbook", "build", t.built);
    if (!existsSync(builtPath)) {
      throw new Error(`Built cookbook binary not found: ${builtPath}`);
    }
    cpSync(builtPath, join(outDir, t.exeName));

    writeFileSync(
      join(outDir, "index.js"),
      `console.log("This package is used to distribute cookbook binaries. You can run it directly.");`,
    );

    writeJson(join(outDir, "package.json"), {
      name: pkgName,
      type: "module",
      version,
      exports: "./index.js",
      repository: repo,
    });

    const raw = readFileSync(join(outDir, "package.json"), "utf-8");
    if (!raw.trim())
      throw new Error(`binary package.json is empty: ${join(outDir, "package.json")}`);
    JSON.parse(raw);

    console.log(`Publishing binary ${pkgName}@${version}...`);
    npmPublish(outDir, npmTag);
  }
}

async function main() {
  const version = process.env.VERSION || getRepoVersion();
  const npmTag = process.env.NPM_TAG ?? getNpmTag(version);

  console.log(`[publish-ci] version=${version}, npmTag=${npmTag || "(latest)"}`);

  // 1) cookbook 二进制分发包
  if (!process.env.SKIP_BINARIES) publishCookbookBinaries(version, npmTag);

  // 2) 构建 dist + 发布（milkio 与 @milkio/*）
  await publishDistPackages(version, npmTag);

  // 3) 发布模板包（template）
  publishTemplatePackages(version, npmTag);

  // 4) 直接发布（create-cookbook / milkio-electron）
  publishDirectPackages(version, npmTag);

  console.log(`[publish-ci] done`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
