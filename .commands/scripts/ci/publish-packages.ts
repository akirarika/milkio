import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readJson, cwd, run, getRepoVersion, getNpmTag, npmViewExists, npmPublish } from "./utils";
import { join } from "node:path";
import { directPackages, distPackages, templatePackages } from "./release-config";

type pkgJson = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
};

function writeDistPackageJson(pkgDir: string, outDir: string) {
  const pkgJson = readJson<pkgJson>(join(pkgDir, "package.json"));

  const out: {
    name: string;
    version: string;
    type: "module";
    exports: "./index.js";
    types: "./index.d.ts";
    dependencies: Record<string, string>;
  } = {
    name: pkgJson.name,
    version: pkgJson.version,
    type: "module",
    exports: "./index.js",
    types: "./index.d.ts",
    dependencies: {},
  };

  //vite-plugin-milkio
  if (pkgDir.endsWith(join("packages", "vite-plugin-milkio"))) {
    const deps = pkgJson.dependencies ?? {};
    if (deps["vite-plugin-node"]) out.dependencies["vite-plugin-node"] = deps["vite-plugin-node"];
    if (deps["@mjackson/node-fetch-server"])
      out.dependencies["@mjackson/node-fetch-server"] = deps["@mjackson/node-fetch-server"];
  }
  writeFileSync(join(outDir, "package.json"), JSON.stringify(out, null, 2));
}

async function buildDist(pkgName: string) {
  const pkgDir = join(cwd, "packages", pkgName);
  const outDir = join(pkgDir, "dist");

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const external: string[] = [];
  if (pkgName === "vite-plugin-milkio")
    external.push("vite-plugin-node", "@mjackson/node-fetch-server");

  const buildResult = await Bun.build({
    entrypoints: [join(pkgDir, "index.ts")],
    outdir: outDir,
    target: "node",
    format: "esm",
    splitting: true,
    sourcemap: "inline",
    minify: false,
    external,
  });
  if (!buildResult.success) {
    const msgs = buildResult.logs.map((l) => l.message).join("\n");

    throw new Error(`Build failed for ${pkgName}\n ${msgs}`);
  }

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
  } catch (error) {
    console.log(`[tsc] skipped/failed for ${pkgName} (non-fatal)`);
  }
  writeDistPackageJson(pkgDir, outDir);
}
const version = process.env.VERSION || getRepoVersion();
const npmTag = process.env.NPM_TAG ?? getNpmTag(version);
console.log(`[publish-node] version=${version}, npmTag=${npmTag || "(latest)"}`);

//构建dist并发布dist
for (const pkg of distPackages) {
  const pkgDir = join(cwd, "packages", pkg);
  const pkgJson = readJson<pkgJson>(join(pkgDir, "package.json"));
  if (npmViewExists(pkgJson.name, version)) {
    console.log(`${pkgJson.name}@${version} already exists, skipping publish`);
    continue;
  }
  console.log(`Building ${pkgJson.name}@${version}...`);
  await buildDist(pkg);
  console.log(`Publishing ${pkgJson.name}@${version}...`);
  npmPublish(join(pkgDir, "dist"), npmTag);
}

//模板包直接发布根目录
for (const pkg of templatePackages) {
  const pkgDir = join(cwd, "packages", pkg);
  const pkgJson = readJson<pkgJson>(join(pkgDir, "package.json"));
  if (npmViewExists(pkgJson.name, version)) {
    console.log(`${pkgJson.name}@${version} already exists, skipping publish`);
    continue;
  }
  console.log(`Publishing ${pkgJson.name}@${version}...`);
  npmPublish(pkgDir, npmTag);
}

//直接发布根目录
for (const pkg of directPackages) {
  const pkgDir = join(cwd, "packages", pkg);
  const pkgJson = readJson<pkgJson>(join(pkgDir, "package.json"));
  if (npmViewExists(pkgJson.name, version)) {
    console.log(`${pkgJson.name}@${version} already exists, skipping publish`);
    continue;
  }
  const distDir = join(pkgDir, "dist");
  if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
  console.log(`Publishing ${pkgJson.name}@${version}...`);
  npmPublish(pkgDir, npmTag);
}
console.log("Done! UwU");
