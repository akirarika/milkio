import { rename, writeFile } from "node:fs/promises";

export async function writeFileAtomic(path: string, content: string): Promise<void> {
    const tmpPath = `${path}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
    await writeFile(tmpPath, content, "utf-8");
    await rename(tmpPath, path);
}
