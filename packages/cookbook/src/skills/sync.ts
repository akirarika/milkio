import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import consola from "consola";
import { MILKIO_SKILL_FILES } from "./milkio-skills.generated";

/** Skill directory name that is managed by cookbook. */
const SKILL_NAME = "milkio";
const SKILL_FILE = "SKILL.md";

/**
 * Private fields written into the skill frontmatter. `metadata` is the Agent
 * Skills spec field for arbitrary client properties (a string-to-string map);
 * the `xMilkio` prefix keeps these keys unique per the spec's recommendation.
 */
const UPDATED_AT_FIELD = "xMilkioUpdatedAt";
const DO_NOT_EDIT_FIELD = "xMilkioDoNotEdit";
const DO_NOT_EDIT_TEXT =
    "This document is managed and overwritten automatically by cookbook. Do not edit it; edit the canonical skill in the milkio repository instead.";
const METADATA_INDENT = "    ";

/**
 * Top-level directories that never contain agent skills (generated output,
 * caches, dependency trees). Kept shallow on purpose: we only look one level
 * below each top-level agent directory.
 */
const SKIP_TOP_LEVEL = new Set([
    ".git",
    ".tmp",
    ".milkio",
    ".nuxt",
    ".output",
    ".data",
    ".config",
    "node_modules",
    "dist",
    "build",
    "worktree-static",
]);

export type SkillSyncReport = {
    /** Skill directories found in this workspace. */
    targets: string[];
    /** Skill directories that were replaced with the embedded version. */
    updated: string[];
};

export type SkillSyncOptions = {
    /** Current time recorded in `metadata.xMilkioUpdatedAt`; injectable for tests. */
    now?: Date;
};

type SkillReporter = {
    success: (message: string) => void;
    info: (message: string) => void;
};

const defaultReporter: SkillReporter = {
    success: (message) => consola.success(message),
    info: (message) => consola.info(message),
};

/**
 * The milkio monorepo itself keeps the canonical skill at
 * `.codebuddy/skills/milkio`; syncing it there would fight the source of truth.
 */
export function isMilkioSourceRepo(root: string): boolean {
    try {
        const packageJson = JSON.parse(
            readFileSync(join(root, "packages", "cookbook", "package.json"), "utf-8"),
        ) as { name?: unknown };
        return packageJson?.name === "@milkio/cookbook";
    } catch {
        return false;
    }
}

/**
 * Rewrite the managed `metadata` fields of a SKILL.md frontmatter block:
 *
 * - `xMilkioUpdatedAt` records when co last overwrote this copy.
 * - `xMilkioDoNotEdit` declares that the file is generated and must not be edited.
 *
 * Other `metadata` keys are preserved. Missing fields (or a missing `metadata`
 * block) are added; the file's line ending style is preserved.
 */
export function withSkillManagedMetadata(content: string, updatedAt: string): string {
    // Preserve the file's line ending style (the canonical skill can be checked
    // out with CRLF on Windows).
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const lines = content.split(/\r?\n/);
    if (lines[0]?.trim() !== "---") return content;

    let closing = -1;
    for (let index = 1; index < lines.length; index++) {
        if (lines[index].trim() === "---") {
            closing = index;
            break;
        }
    }
    if (closing === -1) return content;

    const frontmatter = lines.slice(1, closing);
    const managedLines = [
        `${METADATA_INDENT}${UPDATED_AT_FIELD}: '${updatedAt}'`,
        `${METADATA_INDENT}${DO_NOT_EDIT_FIELD}: '${DO_NOT_EDIT_TEXT}'`,
    ];

    let metadataIndex = -1;
    for (let index = 0; index < frontmatter.length; index++) {
        if (/^metadata\s*:\s*$/.test(frontmatter[index])) {
            metadataIndex = index;
            break;
        }
    }

    if (metadataIndex === -1) {
        frontmatter.push("metadata:", ...managedLines);
    } else {
        // Collect the existing metadata block (indented lines until the next
        // top-level key), drop managed fields, then append the fresh values.
        const managedPattern = new RegExp(`^\\s+(?:${UPDATED_AT_FIELD}|${DO_NOT_EDIT_FIELD})\\s*:`);
        const block: string[] = [];
        let end = metadataIndex + 1;
        while (end < frontmatter.length) {
            const line = frontmatter[end];
            if (line.trim().length > 0 && !/^\s/.test(line)) break;
            block.push(line);
            end++;
        }
        const preserved = block.filter((line) => line.trim().length > 0 && !managedPattern.test(line));
        frontmatter.splice(metadataIndex + 1, block.length, ...preserved, ...managedLines);
    }

    return [lines[0], ...frontmatter, lines[closing], ...lines.slice(closing + 1)].join(eol);
}

async function isSkillDir(dir: string): Promise<boolean> {
    return existsSync(join(dir, SKILL_FILE));
}

/**
 * Find repo-local agent skill directories named `milkio`.
 *
 * Supported layouts (all repo-local, never global):
 *   - `<agent>/skills/milkio` (`.agents`, `.claude`, `.codebuddy`, `.trae`, `.workbuddy`, `.dsh`, ...)
 *   - `<agent>/milkio` (older/other layouts)
 *   - `skills/milkio` at the workspace root
 *
 * A directory only counts when it contains `SKILL.md`; this prevents replacing
 * unrelated directories such as `.dsh/plugins/milkio`.
 */
export async function findMilkioSkillDirs(root: string): Promise<string[]> {
    const found = new Set<string>();

    const rootSkills = join(root, "skills", SKILL_NAME);
    if (await isSkillDir(rootSkills)) found.add(rootSkills);

    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
        entries = await readdir(root, { withFileTypes: true });
    } catch {
        return [];
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!entry.name.startsWith(".")) continue;
        if (SKIP_TOP_LEVEL.has(entry.name)) continue;
        const base = join(root, entry.name);
        for (const candidate of [join(base, "skills", SKILL_NAME), join(base, SKILL_NAME)]) {
            if (await isSkillDir(candidate)) found.add(candidate);
        }
    }

    return [...found].sort();
}

/**
 * Replace every repo-local `milkio` skill directory with the skill version
 * embedded in this cookbook build.
 *
 * Directories are always delete-then-rewritten, so files removed from the
 * canonical skill disappear downstream and `metadata.xMilkioUpdatedAt` always
 * records the moment this command refreshed the copy. Missing skill
 * directories are never created — only existing ones are updated.
 */
export async function syncMilkioSkills(
    root: string,
    reporter: SkillReporter = defaultReporter,
    options: SkillSyncOptions = {},
): Promise<SkillSyncReport> {
    const report: SkillSyncReport = { targets: [], updated: [] };
    if (isMilkioSourceRepo(root)) return report;

    const skillDirs = await findMilkioSkillDirs(root);
    report.targets = skillDirs;
    const updatedAt = (options.now ?? new Date()).toISOString();

    for (const dir of skillDirs) {
        await rm(dir, { recursive: true, force: true });
        for (const [relativePath, original] of Object.entries(MILKIO_SKILL_FILES)) {
            const targetPath = join(dir, ...relativePath.split("/"));
            await mkdir(dirname(targetPath), { recursive: true });
            const content =
                relativePath === SKILL_FILE ? withSkillManagedMetadata(original, updatedAt) : original;
            await writeFile(targetPath, content, "utf-8");
        }
        report.updated.push(dir);
    }

    if (report.updated.length > 0) {
        reporter.success(
            `milkio skills updated (${report.updated.length}/${skillDirs.length}, ${updatedAt}): ${report.updated
                .map((dir) => dir.replace(root, "").replace(/^[/\\]/, ""))
                .join(", ")}`,
        );
    } else {
        reporter.info("no milkio skill directory found in this workspace, skipped.");
    }

    return report;
}
