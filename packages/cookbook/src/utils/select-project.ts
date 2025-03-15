import { search } from "@inquirer/prompts";
import type { CookbookOptions } from "./cookbook-dto-types";
import { uniqWith } from "lodash-es";
import { join } from "node:path";
import { cwd } from "node:process";

export async function selectProject(cookbookToml: CookbookOptions): Promise<null | CookbookOptions['projects'][0] & { value: any, path: string }> {
    const projects: Array<CookbookOptions['projects'] & { value: any }> = [];
    for (const projectName in cookbookToml.projects) {
        const project = (cookbookToml.projects[projectName] as any);
        projects.push({ ...project, name: project.name ?? project.key, value: projectName })
    }

    const selected = await search({
        message: "Select your project:",
        source: async (input) => {
            if (!input) return projects;
            const filtered = projects.filter((project) =>
                containsCharsInOrder(input.toLowerCase(), project.value.toLowerCase())
            );

            return uniqWith(filtered, (a, b) => a.value === b.value)
                .sort((a, b) => {
                    const scoreA = calculateScore(input, a.value);
                    const scoreB = calculateScore(input, b.value);

                    // 优先按最长连续匹配降序排序
                    if (scoreB.maxContiguous !== scoreA.maxContiguous) {
                        return scoreB.maxContiguous - scoreA.maxContiguous;
                    }

                    // 连续长度相同时，按匹配起始位置升序排序
                    return scoreA.firstMatchIndex - scoreB.firstMatchIndex;
                });
        },
    });
    
    const project = projects.find((project) => project.value === selected);
    if (!project) return null;
    return { ...project, path: join(cwd(), 'projects', project.value) } as any;
}

const containsCharsInOrder = (input: string, target: string): boolean => {
    let inputIndex = 0;
    for (const char of target) {
        if (char === input[inputIndex]) {
            inputIndex++;
            if (inputIndex === input.length) break;
        }
    }
    return inputIndex === input.length;
};
const calculateScore = (input: string, target: string) => {
    let maxContiguous = 0;
    let currentContiguous = 0;
    let firstMatchIndex = -1;

    let inputIndex = 0;
    for (let i = 0; i < target.length; i++) {
        if (target[i] === input[inputIndex]) {
            if (firstMatchIndex === -1) firstMatchIndex = i;
            currentContiguous++;
            inputIndex++;
            maxContiguous = Math.max(maxContiguous, currentContiguous);
        } else {
            currentContiguous = 0;
        }
    }

    return { maxContiguous, firstMatchIndex };
};