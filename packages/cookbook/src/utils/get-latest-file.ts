import { statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";

export async function getLatestFile(directoryPath: string, endsWith: string): Promise<string> {
  const files = await readdir(directoryPath);

  const tsFiles = files.filter((file) => file.endsWith(endsWith)).map((file) => join(directoryPath, file));

  if (tsFiles.length === 0) throw new Error(`This directory is empty: ${directoryPath}`);

  if (tsFiles.length === 1) return basename(tsFiles[0]);

  const filesWithStats = tsFiles.map((filePath) => ({
    name: basename(filePath),
    birthtime: statSync(filePath).birthtimeMs,
  }));

  const latestFile = filesWithStats.reduce((latest, current) => (current.birthtime > latest.birthtime ? current : latest));

  return latestFile.name;
}
