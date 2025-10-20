import { defineCookbookCommand } from "@milkio/cookbook-command";
import { gitUserCheck } from "./utils/git-user-check.ts";
import { $ } from "bun";
import { exit } from "node:process";
import consola from "consola";

export default await defineCookbookCommand(async (utils) => {
    const cookbookToml = await utils.getCookbookToml();
    await gitUserCheck();

    let branch: string;
    try {
        branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
    } catch (error) {
        branch = await utils.inputString({
            env: "branch",
            message: "Enter Git branch name",
            placeholder: "feature/your-feature-name",
        });
    }

    await $`git add --all`;
    consola.start("Checking git changes..");
    const diff = `${(await $`git diff`.text()).trim()}\n${(await $`git diff --staged`.text()).trim()}`;

    if (/^\s*$/g.test(diff)) {
        consola.success("No staged changes detected");
        exit(0);
    }

    const ai = await utils.useAIConfig();
    let commitMessage = "";

    if (ai && diff.length < 131071) {
        await utils.openProgress(`Generating AI commit message (${ai.aiModel})..`);
        const instructions = `
# Role

You are a professional git commit analyst responsible for generating standardized commit messages based on git diff content.  

# Task Requirements
Strictly analyze provided git diff content.  

Determine change type (select one):
✨ feat: new feature
🧊 fix: bug fix
🦄 improve: performance/experience optimization
📄 docs: documentation-related
✅ test: test-related
🔨 chore: other adjustments  
Precisely describe changes in ≤15 English characters.  

Ignore file paths, line numbers, and details.  

Avoid technical pronouns like "新增" (added) or "修复" (fixed).  

Format: "[emoji] [type]: [description]"  

# Output Specifications
Start with designated emoji:  

feat → ✨
fix → 🧊
improve → 🦄
docs → 📄
test → ✅
chore → 🔨
Use English for descriptions.  

Examples:  

✨ feat: user login functionality  
🧊 fix: image loading failure  
🦄 improve: search response speed  

Output only the final result without extraneous text. Your result will be directly used as the commit message.
Note: the first word should be lowercase unless it is a proper noun or abbreviation all words should be lowercase and do not add any punctuation like periods question marks or exclamation points at the end.
`;

        const response = await utils.fetchEventSource(`${ai.aiBaseUrl}/chat/completions`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${ai.aiApiKey}`,
            },
            method: "POST",
            body: JSON.stringify({
                model: ai.aiModel,
                messages: [
                    { role: "system", content: instructions },
                    { role: "user", content: diff },
                ],
                stream: true,
            }),
        });

        for await (const chunk of response) {
            const content = chunk.data?.choices?.at(0)?.delta?.content ?? "";
            commitMessage += content;
        }
        commitMessage = commitMessage.trim();
        await utils.closeProgress("Generated!");
    }

    if (diff.length >= 8_388_608) consola.warn("Diff too long for AI analysis");

    let finalMessage = "";
    consola.start(`AI commit message:\n${commitMessage}`);
    if (
        commitMessage &&
        (await utils.inputBoolean({
            env: "is-it-adopted",
            message: "Use AI generated commit?",
        }))
    ) {
        finalMessage = commitMessage;
    } else {
        finalMessage = await utils.inputString({
            env: "message",
            message: "Enter commit message",
            placeholder: commitMessage || "✨ feat: add a new feature",
        });
        if (!finalMessage) exit(0);
    }

    await $`git commit -m '${finalMessage.replaceAll("'", '"')}'`;

    // 保留原有的推送和拉取逻辑
    while (true) {
        try {
            await $`git push -u origin ${branch}`;
            break;
        } catch (error) {
            consola.error(error);
            if (
                !(await utils.inputBoolean({
                    env: "retry",
                    message: "Retry push after error?",
                }))
            )
                exit(0);
        }
    }

    consola.log("Syncing remote changes...");
    try {
        await $`git pull --rebase origin ${branch}`;
    } catch {
        consola.warn("Commit pushed but pull failed");
    }
    consola.success(`Branch '${branch}' synchronized`);
});
