import { readFileSync } from "fs-extra";
import { mainPackage } from "./release-config";
import { join } from "node:path";

export const cwd = process.cwd();

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

export function getRepoVersion(): string {
  const pkg = readJson<{ version: string }>(join(cwd, "packages", mainPackage, "package.json"));
  return pkg.version;
}

export function getNpmTag(version: string): "rc" | "beta" | "alpha" | "" {
  if (version.includes("-rc.")) return "rc";
  if (version.includes("-beta.")) return "beta";
  if (version.includes("-alpha")) return "alpha";
  return "";
}

export function run(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string> },
) {
  const result = Bun.spawnSync({
    cmd: [cmd, ...args],
    cwd: opts?.cwd ?? cwd,
    env: { ...process.env, ...opts?.env },
    stdout: "inherit",
    stderr: "inherit",
  });

  if (result.exitCode !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
  }
}
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

export function npmViewExists(pgkName: string, version: string): boolean {
  const result = Bun.spawnSync({
    cmd: [npmCmd, "view", `${pgkName}@${version}`, "--json"],
    cwd: cwd,
    stdout: "ignore",
    stderr: "ignore",
  });
  return result.exitCode === 0;
}
export function npmPublish(cwd: string, npmTag: string) {
  const args = ["publish", "--access", "public"];
  if (npmTag) args.push("--tag", npmTag);
  run(npmCmd, args, { cwd });
}
