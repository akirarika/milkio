import { existsSync } from "node:fs";
import { glob, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import type { Stats } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { platform } from "node:process";
import * as TOML from "@iarna/toml";

/**
 * Node-compatible replacements for the Bun APIs that cookbook used before the
 * Vite+/Node migration. Keeping them in one place makes the runtime surface of
 * the CLI explicit and easy to audit.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

/** Equivalent of writeFileEnsured(): creates missing parent directories. */
export async function writeFileEnsured(path: string, data: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

/** Equivalent of `(await pathExists(path))`. */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Equivalent of `fileStat(path)`. */
export async function fileStat(path: string): Promise<Stats> {
  return stat(path);
}

export function parseToml<T = Record<string, any>>(text: string): T {
  return TOML.parse(text) as unknown as T;
}

/** Locate an executable on PATH (synchronous, cross-platform). */
export function whichSync(command: string): string | null {
  const pathValue = process.env.PATH ?? "";
  const extensions =
    platform === "win32" ? (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean) : [""];
  const hasKnownExtension =
    platform === "win32" && extensions.some((extension) => command.toLowerCase().endsWith(extension.toLowerCase()));

  for (const directory of pathValue.split(delimiter)) {
    if (!directory) continue;
    if (hasKnownExtension) {
      const candidate = join(directory, command);
      if (existsSync(candidate)) return candidate;
      continue;
    }
    for (const extension of extensions) {
      const candidate = join(directory, command + extension);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * True when the CLI runs from a self-contained binary (Node SEA or Bun
 * compiled). In that case process.argv[1] is not a real script on disk, so it
 * must never be forwarded to a child process as a script argument.
 */
export function isStandaloneBinary(): boolean {
  const entry = process.argv[1];
  if (typeof entry !== "string" || entry.length === 0) return false;
  if (entry === process.execPath) return true;
  // Bun compiled binaries expose a virtual "B:/~BUN/root/..." entry point.
  return entry.includes("/~BUN/") || entry.includes("\\~BUN\\");
}

/** Async iterator over files matching a glob pattern, relative to cwd. */
export async function* globFiles(pattern: string, cwd: string): AsyncGenerator<string> {
  for await (const entry of glob(pattern, { cwd })) {
    yield String(entry);
  }
}
