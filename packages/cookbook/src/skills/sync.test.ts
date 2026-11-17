import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { MILKIO_SKILL_FILES } from "./milkio-skills.generated";
import {
    findMilkioSkillDirs,
    isMilkioSourceRepo,
    syncMilkioSkills,
    withSkillManagedMetadata,
} from "./sync";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../..");
const CANONICAL_SKILL_DIR = join(REPO_ROOT, ".codebuddy", "skills", "milkio");

let tempRoots: string[] = [];

async function makeWorkspace(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "milkio-skills-"));
    tempRoots.push(root);
    return root;
}

async function writeFileAt(root: string, relativePath: string, content: string): Promise<void> {
    const target = join(root, ...relativePath.split("/"));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf-8");
}

afterEach(async () => {
    for (const root of tempRoots) await rm(root, { recursive: true, force: true });
    tempRoots = [];
});

describe("syncMilkioSkills", () => {
    test("replaces every repo-local agent skill copy and removes stale files", async () => {
        const root = await makeWorkspace();
        for (const agentDir of [".agents", ".codebuddy", ".trae", ".workbuddy"]) {
            await writeFileAt(root, `${agentDir}/skills/milkio/SKILL.md`, "stale");
            await writeFileAt(root, `${agentDir}/skills/milkio/legacy-removed.md`, "remove me");
        }

        const report = await syncMilkioSkills(root, { success: () => {}, info: () => {} }, { now: new Date("2030-01-02T03:04:05.000Z") });

        expect(report.targets).toHaveLength(4);
        expect(report.updated).toHaveLength(4);
        for (const agentDir of [".agents", ".codebuddy", ".trae", ".workbuddy"]) {
            const skillDir = join(root, agentDir, "skills", "milkio");
            const skillContent = (await readFile(join(skillDir, "SKILL.md"), "utf-8")).replace(/\r\n/g, "\n");
            expect(skillContent).toBe(
                withSkillManagedMetadata(MILKIO_SKILL_FILES["SKILL.md"], "2030-01-02T03:04:05.000Z").replace(
                    /\r\n/g,
                    "\n",
                ),
            );
            expect(skillContent).toContain("metadata:\n    xMilkioUpdatedAt: '2030-01-02T03:04:05.000Z'");
            expect(skillContent).toContain("    xMilkioDoNotEdit: 'This document is managed and overwritten automatically by cookbook.");
            expect(existsSync(join(skillDir, "legacy-removed.md"))).toBe(false);
            for (const relativePath of Object.keys(MILKIO_SKILL_FILES)) {
                expect(existsSync(join(skillDir, ...relativePath.split("/")))).toBe(true);
                if (relativePath !== "SKILL.md") {
                    expect(await readFile(join(skillDir, ...relativePath.split("/")), "utf-8")).toBe(
                        MILKIO_SKILL_FILES[relativePath],
                    );
                }
            }
        }
    });

    test("refreshes the copies and records metadata.xMilkioUpdatedAt on every sync", async () => {
        const root = await makeWorkspace();
        await writeFileAt(root, ".agents/skills/milkio/SKILL.md", "stale");

        const first = await syncMilkioSkills(root, { success: () => {}, info: () => {} }, {
            now: new Date("2030-01-02T03:04:05.000Z"),
        });
        expect(first.updated).toHaveLength(1);
        const firstContent = (
            await readFile(join(root, ".agents", "skills", "milkio", "SKILL.md"), "utf-8")
        ).replace(/\r\n/g, "\n");
        expect(firstContent).toContain("metadata:\n    xMilkioUpdatedAt: '2030-01-02T03:04:05.000Z'");

        const second = await syncMilkioSkills(root, { success: () => {}, info: () => {} }, {
            now: new Date("2030-02-03T04:05:06.000Z"),
        });
        expect(second.targets).toHaveLength(1);
        expect(second.updated).toHaveLength(1);
        const secondContent = (
            await readFile(join(root, ".agents", "skills", "milkio", "SKILL.md"), "utf-8")
        ).replace(/\r\n/g, "\n");
        expect(secondContent).toContain("metadata:\n    xMilkioUpdatedAt: '2030-02-03T04:05:06.000Z'");
        expect(secondContent).not.toBe(firstContent);
    });

    test("never creates missing skill directories", async () => {
        const root = await makeWorkspace();
        await mkdir(join(root, ".claude", "skills"), { recursive: true });

        const report = await syncMilkioSkills(root, { success: () => {}, info: () => {} });

        expect(report.targets).toHaveLength(0);
        expect(existsSync(join(root, ".claude", "skills", "milkio"))).toBe(false);
    });

    test("ignores directories without SKILL.md (e.g. .dsh/plugins/milkio)", async () => {
        const root = await makeWorkspace();
        await writeFileAt(root, ".dsh/plugins/milkio/index.js", "module.exports = {};");
        await writeFileAt(root, ".dsh/plugins/milkio/package.json", "{}");

        const report = await syncMilkioSkills(root, { success: () => {}, info: () => {} });

        expect(report.targets).toHaveLength(0);
        expect(await readFile(join(root, ".dsh/plugins/milkio/index.js"), "utf-8")).toBe("module.exports = {};");
    });

    test("supports root-level skills/milkio and <agent>/milkio layouts", async () => {
        const root = await makeWorkspace();
        await writeFileAt(root, "skills/milkio/SKILL.md", "stale");
        await writeFileAt(root, ".some-agent/milkio/SKILL.md", "stale");

        const targets = await findMilkioSkillDirs(root);
        expect(targets).toHaveLength(2);

        const report = await syncMilkioSkills(root, { success: () => {}, info: () => {} });
        expect(report.updated).toHaveLength(2);
    });

    test("skips the milkio source repository itself", async () => {
        const root = await makeWorkspace();
        await writeFileAt(root, "packages/cookbook/package.json", JSON.stringify({ name: "@milkio/cookbook" }));
        await writeFileAt(root, ".codebuddy/skills/milkio/SKILL.md", "canonical source, do not touch");

        expect(isMilkioSourceRepo(root)).toBe(true);
        const report = await syncMilkioSkills(root, { success: () => {}, info: () => {} });

        expect(report.targets).toHaveLength(0);
        expect(await readFile(join(root, ".codebuddy/skills/milkio/SKILL.md"), "utf-8")).toBe(
            "canonical source, do not touch",
        );
    });
});

describe("withSkillManagedMetadata", () => {
    test("replaces the managed fields and keeps other metadata", () => {
        const content = [
            "---",
            "name: milkio",
            "description: test",
            "metadata:",
            "    xMilkioUpdatedAt: '2020-01-01T00:00:00.000Z'",
            "    xMilkioDoNotEdit: 'old notice'",
            "    other: 'keep-me'",
            "---",
            "",
            "# Body",
        ].join("\n");

        const result = withSkillManagedMetadata(content, "2030-02-03T04:05:06.000Z");

        expect(result).toContain("    xMilkioUpdatedAt: '2030-02-03T04:05:06.000Z'");
        expect(result).toContain("    other: 'keep-me'");
        expect(result).toContain("# Body");
        expect(result.match(/xMilkioUpdatedAt:/g)).toHaveLength(1);
        expect(result.match(/xMilkioDoNotEdit:/g)).toHaveLength(1);
        expect(result).not.toContain("old notice");
    });

    test("inserts managed metadata when the frontmatter has none", () => {
        const content = ["---", "name: milkio", "description: test", "---", "", "# Body"].join("\n");

        const result = withSkillManagedMetadata(content, "2030-02-03T04:05:06.000Z");

        expect(result).toContain(
            [
                "metadata:",
                "    xMilkioUpdatedAt: '2030-02-03T04:05:06.000Z'",
                "    xMilkioDoNotEdit: 'This document is managed and overwritten automatically by cookbook. Do not edit it;",
            ].join("\n"),
        );
        expect(result.indexOf("metadata:")).toBeLessThan(result.indexOf("\n---", 4));
    });

    test("leaves content without frontmatter untouched", () => {
        expect(withSkillManagedMetadata("# No frontmatter", "2030-02-03T04:05:06.000Z")).toBe(
            "# No frontmatter",
        );
    });
});

describe("embedded skills", () => {
    test("generated map matches .codebuddy/skills/milkio", async () => {
        // Downstream checkouts (published package only) do not ship the source dir.
        if (!existsSync(CANONICAL_SKILL_DIR)) return;

        const { readdir } = await import("node:fs/promises");
        const expected: Record<string, string> = {};
        const walk = async (current: string, prefix: string): Promise<void> => {
            const entries = await readdir(current, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith(".")) continue;
                const relativePath = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`;
                if (entry.isDirectory()) await walk(join(current, entry.name), relativePath);
                else if (entry.isFile()) expected[relativePath] = await readFile(join(current, entry.name), "utf-8");
            }
        };
        await walk(CANONICAL_SKILL_DIR, "");

        expect(Object.keys(MILKIO_SKILL_FILES).sort()).toEqual(Object.keys(expected).sort());
        for (const relativePath of Object.keys(expected)) {
            expect(MILKIO_SKILL_FILES[relativePath]).toBe(expected[relativePath]);
        }
    });
});
