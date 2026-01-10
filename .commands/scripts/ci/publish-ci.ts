// .commands/scripts/ci/publish-ci.ts
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const cwd = process.cwd();

const mainPackage = "milkio";
const childPackages = [
  "cookbook",
  "create-cookbook",
  "milkio-electron",
  "cookbook-command",
  "milkio-astra",
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

function run(cmd: string, args: string[], opts?: { cwd?: string; env?: Record<string, string> }) {
  const r = Bun.spawnSync({
    cmd: [cmd, ...args],
    cwd: opts?.cwd ?? cwd,
    env: { ...process.env, ...opts?.env },
    stdout: "inherit",
    stderr: "inherit",
  });
  if (r.exitCode !== 0) throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
}

function npmViewExists(pkgName: string, version: string): boolean {
  const r = Bun.spawnSync({
    cmd: [npmCmd(), "view", `${pkgName}@${version}`, "--json"],
    cwd,
    env: { ...process.env },
    stdout: "ignore",
    stderr: "ignore",
  });
  return r.exitCode === 0;
}

function npmPublish(dir: string, npmTag: string) {
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
  }

  const outPath = join(outDir, "package.json");
  writeJson(outPath, out);
  const raw = readFileSync(outPath, "utf-8");
  if (!raw.trim()) throw new Error(`dist/package.json is empty: ${outPath}`);
  JSON.parse(raw);
}

async function buildDist(pkgName: string) {
  const pkgDir = join(cwd, "packages", pkgName);
  const outDir = join(pkgDir, "dist");

  rmSync(outDir, { recursive: true, force: true });
  ensureDir(outDir);

  const external: string[] = [];
  if (pkgName === "vite-plugin-milkio")
    external.push("vite-plugin-node", "@mjackson/node-fetch-server");

  const result = await Bun.build({
    entrypoints: [join(pkgDir, "index.ts")],
    outdir: outDir,
    target: "node",
    format: "esm",
    splitting: true,
    sourcemap: "inline",
    minify: false,
    external,
  });

  if (!result.success) {
    const msgs = result.logs.map((l) => l.message).join("\n");
    throw new Error(`Build failed for ${pkgName}\n${msgs}`);
  }

  // d.ts：保持你本地脚本行为：失败不阻断
  try {
    run(
      process.execPath,
      [
        "../../node_modules/typescript/bin/tsc",
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
      ],
      { cwd: pkgDir },
    );
  } catch {
    console.log(`[tsc] skipped/failed for ${pkgName} (non-fatal)`);
  }

  copyLicenseTo(outDir);
  writeDistPackageJson(pkgDir, outDir);
}

async function publishDistPackages(version: string, npmTag: string) {
  for (const pkg of [mainPackage, ...childPackages]) {
    if (
      pkg.startsWith("template-") ||
      pkg === "cookbook" ||
      pkg === "cookbook-ui" ||
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

function publishCookbookBinaries(version: string, npmTag: string) {
  const repo = normalizeRepository(
    readJson<PkgJson>(join(cwd, "packages", mainPackage, "package.json")).repository,
  );

  const cookbookDistRoot = join(cwd, "packages", "cookbook", "dist");
  ensureDir(cookbookDistRoot);

  const targets = [
    { platform: "darwin", arch: "arm64", target: "bun-darwin-arm64" },
    { platform: "darwin", arch: "x64", target: "bun-darwin-x64" },
    { platform: "linux", arch: "arm64", target: "bun-linux-arm64" },
    { platform: "linux", arch: "x64", target: "bun-linux-x64" },
    { platform: "win32", arch: "x64", target: "bun-windows-x64" },
  ];

  for (const t of targets) {
    const pkgName = `@milkio/cookbook-${t.platform}-${t.arch}`;

    if (npmViewExists(pkgName, version)) {
      console.log(`${pkgName}@${version} already exists, skipping publish`);
      continue;
    }

    const outDir = join(cookbookDistRoot, `cookbook-${t.platform}-${t.arch}`);
    rmSync(outDir, { recursive: true, force: true });
    ensureDir(outDir);

    console.log(`Building binary ${pkgName}@${version}...`);
    run(
      process.execPath,
      [
        "build",
        join(cwd, "packages", "cookbook", "cookbook.ts"),
        "--outfile",
        join(outDir, "co"),
        "--compile",
        "--minify",
        "--sourcemap=inline",
        "--env=COOKBOOK_*",
        "--target",
        t.target,
        "--external",
        "vue",
        "--external",
        "react",
      ],
      { env: { COOKBOOK_PRODUCTION: "true" } },
    );

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
  publishCookbookBinaries(version, npmTag);

  // 2) 构建 dist + 发布（milkio 与 @milkio/*）
  await publishDistPackages(version, npmTag);

  // 3) 发布模板包（template）
  publishTemplatePackages(version, npmTag);

  // 4) 直接发布（create-cookbook / milkio-electron）
  publishDirectPackages(version, npmTag);

  console.log(`[publish-ci] done`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
