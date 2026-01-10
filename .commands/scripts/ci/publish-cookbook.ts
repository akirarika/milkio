import { join } from "node:path";
import { getNpmTag, getRepoVersion, npmViewExists, cwd, run, npmPublish } from "./utils";
import { readFileSync, writeFileSync } from "node:fs";

const platform = process.platform;
const arch = process.env.ARCH;
const target = process.env.TARGET;

if (!platform || !arch || !target) {
  throw new Error("Missing env: PLATFORM, ARCH, TARGET");
}
const version = process.env.VERSION || getRepoVersion();
const npmTag = process.env.NPM_TAG ?? getNpmTag(version);

const pkgName = `@milkio/cookbook-${platform}-${arch}`;
if (npmViewExists(pkgName, version)) {
  console.log(`${pkgName}@${version} already exists, skipping publish`);
  process.exit(0);
}

const outDir = join(cwd, "packages", "cookbook", "dist", `cookbook-${platform}-${arch}`);
const repo = JSON.parse(readFileSync(join(cwd, "packages", "milkio", "package.json"), "utf-8"))
  .repository ?? { type: "git", url: "https://github.com/akirarika/milkio" };

run(process.execPath, [
  "build",
  join(cwd, "packages", "cookbook", "cookbook.ts"),
  "--outfile",
  join(outDir, "co"),
  "--compile",
  "--minify",
  "--sourcemap=inline",
  "--env=COOKBOOK_*",
  "--target",
  target,
  "--external",
  "vue",
  "--external",
  "react",
]);
{
}

writeFileSync(
  join(outDir, "index.js"),
  `console.log("This package is used to distribute cookbook binaries. You can run it directly.");`,
);
writeFileSync(
  join(outDir, "package.json"),
  JSON.stringify(
    { name: pkgName, type: "module", version, exports: "./index.js", repository: repo },
    null,
    2,
  ),
);
console.log(`[publish] ${pkgName}@${version} (npmTag=${npmTag || "latest"})`);
npmPublish(outDir, npmTag);
console.log(`cookbook publish done! UwU`);
