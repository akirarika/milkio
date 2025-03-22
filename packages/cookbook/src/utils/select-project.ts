import { search } from "@inquirer/prompts";
import type { CookbookOptions } from "./cookbook-dto-types";
import { uniqWith } from "lodash-es";
import { join } from "node:path";
import { cwd, exit } from "node:process";
import consola from "consola";

export async function selectProject(cookbookToml: CookbookOptions, filter?: (project: CookbookOptions["projects"][0] & { value: string }) => boolean | Promise<boolean>): Promise<null | (CookbookOptions["projects"][0] & { value: any; path: string })> {
  const projects: Array<CookbookOptions["projects"] & { value: any }> = [{ value: "<cancel>" } as any];
  for (const projectName in cookbookToml.projects) {
    let project = cookbookToml.projects[projectName] as any;
    project = { ...project, name: project.name ?? project.key, value: projectName };
    if (filter === undefined || (await filter(project))) projects.push(project);
  }

  const selected = await search({
    message: "Select the project to operate on:",
    source: async (input) => {
      if (!input) return projects;
      const filtered = projects.filter((project) => containsCharsInOrder(input.toLowerCase(), project.value.toLowerCase()));
      return uniqWith(filtered, (a, b) => a.value === b.value).sort((a, b) => {
        const scoreA = calculateScore(input, a.value);
        const scoreB = calculateScore(input, b.value);
        if (scoreB.maxContiguous !== scoreA.maxContiguous) {
          return scoreB.maxContiguous - scoreA.maxContiguous;
        }
        return scoreA.firstMatchIndex - scoreB.firstMatchIndex;
      });
    },
  });

  if (selected === "<cancel>") {
    consola.success("Cookbook cancelled");
    exit(0);
  }
  const project = projects.find((project) => project.value === selected);
  if (!project) return null;
  return { ...project, path: join(cwd(), "projects", project.value) } as any;
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
