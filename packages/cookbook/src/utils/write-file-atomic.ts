import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeFileAtomic(path: string, content: string): Promise<void> {
    // Bun.write 会自动创建父目录，node:fs 不会——这里补齐，保持与替换前一致的行为
    await mkdir(dirname(path), { recursive: true });
    const tmpPath = `${path}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
    await writeFile(tmpPath, content, "utf-8");
    await rename(tmpPath, path);
}
