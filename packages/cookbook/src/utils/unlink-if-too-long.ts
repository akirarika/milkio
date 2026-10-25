import { stat, unlink } from "node:fs/promises";
import { pathExists } from "./node-compat";

export async function unlinkIfTooLong(filePath: string) {
  try {
    if (!(await pathExists(filePath))) return;
    const stats = await stat(filePath);
    const fileMTime = stats.mtime;
    const now = Date.now();
    const diffMs = now - fileMTime.getTime();
    if (diffMs > 65535) await unlink(filePath);
  } catch (error) {}
}
