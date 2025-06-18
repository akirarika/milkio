import { statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function getLatestSchemaFolder(directoryPath: string): Promise<string> {
  const items = await readdir(directoryPath, { withFileTypes: true });

  const folders = items.filter((item) => item.isDirectory()).map((folder) => folder.name);

  if (folders.length === 0) {
    throw new Error(`No hash folders found in directory: ${directoryPath}`);
  }

  const foldersWithStats = folders.flatMap((folder) => {
    const schemaPath = join(directoryPath, folder, "schema.ts");
    try {
      const stats = statSync(schemaPath);
      return [
        {
          folder,
          birthtime: stats.birthtimeMs,
        },
      ];
    } catch {
      return [];
    }
  });

  if (foldersWithStats.length === 0) {
    throw new Error(`No valid schema.ts files found in any hash folders: ${directoryPath}`);
  }

  const latestFolder = foldersWithStats.reduce((latest, current) => (current.birthtime > latest.birthtime ? current : latest));

  return latestFolder.folder;
}
