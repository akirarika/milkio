/**
 * Embed the canonical milkio skill (`.codebuddy/skills/milkio`) into the
 * cookbook package as a TypeScript string map.
 *
 * Why embed instead of shipping files: `co` is distributed as a self-contained
 * single executable (Node SEA), so it cannot read skill files from the package
 * directory at runtime. The generated map is bundled into both the binary and
 * the npm dist build, which lets `co` sync skills into downstream workspaces.
 *
 * Run automatically by `.prepare.ts` (dev flow) and `.publ-ci.ts` (publish).
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const SOURCE_DIR = join(REPO_ROOT, ".codebuddy", "skills", "milkio");
const TARGET_FILE = join(HERE, "..", "src", "skills", "milkio-skills.generated.ts");

export type GenerateSkillsResult = {
    sourceDir: string;
    targetFile: string;
    count: number;
};

/** Read every file under the source directory into a POSIX-path keyed map. */
async function collectFiles(root: string, current = root): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    const entries = await readdir(current, { withFileTypes: true });
    // Deterministic output order, independent of the filesystem.
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const absolute = join(current, entry.name);
        if (entry.isDirectory()) {
            Object.assign(files, await collectFiles(root, absolute));
            continue;
        }
        if (!entry.isFile()) continue;
        const relativePath = relative(root, absolute).replaceAll("\\", "/");
        files[relativePath] = await readFile(absolute, "utf-8");
    }
    return files;
}

/**
 * Regenerate `src/skills/milkio-skills.generated.ts` from the repo's canonical
 * skill directory. Returns `null` when the source directory is absent (e.g. a
 * downstream checkout that only installed the published packages).
 */
export async function generateSkills(): Promise<GenerateSkillsResult | null> {
    if (!existsSync(SOURCE_DIR)) return null;

    const files = await collectFiles(SOURCE_DIR);
    const header = [
        "// AUTO-GENERATED FILE - DO NOT EDIT.",
        "// Source: .codebuddy/skills/milkio (regenerate with `node packages/cookbook/scripts/generate-skills.ts`",
        "// or via `.prepare.ts` / `.publ-ci.ts`).",
        "",
    ].join("\n");
    const body = `export const MILKIO_SKILL_FILES: Record<string, string> = ${JSON.stringify(files, null, 4)};\n`;

    await mkdir(dirname(TARGET_FILE), { recursive: true });
    await writeFile(TARGET_FILE, `${header}${body}`, "utf-8");

    return { sourceDir: SOURCE_DIR, targetFile: TARGET_FILE, count: Object.keys(files).length };
}

// Allow direct execution: `node packages/cookbook/scripts/generate-skills.ts`
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await generateSkills();
    if (result === null) {
        console.log(`[skills] source not found, skipped: ${SOURCE_DIR}`);
    } else {
        console.log(`[skills] embedded ${result.count} file(s) -> ${relative(REPO_ROOT, result.targetFile)}`);
    }
}
