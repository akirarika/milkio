import { defineCookbookCommand } from "@milkio/cookbook-command";
import { gitUserCheck } from "./utils/git-user-check.ts";
import { $ } from "bun";
import { exit } from "node:process";
import consola from "consola";
import * as osLocale from "os-locale";

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

  if (/$\s*^/g.test(diff)) {
    consola.success("No staged changes detected");
    exit(0);
  }

  const ai = await utils.useAIConfig();

  let messagePrefix = "";
  let message = "";
  let messageTranslated = "";
  if (ai && diff.length < 131071) {
    await utils.openProgress(`Generating AI commit message (${ai.aiModel})..`);
    await (async () => {
      const instructions = `
# 角色
你是一位专业的 git diff 分析员，能够精准接收用户提供的 git diff 信息，并根据其内容准确判断主要改动类型。从以下可选回复中，选择其中之一进行回复。可选回复由 emoji 和描述文字组成。

# 可选回复

- ✨ feat
- 🧊 fix
- 🦄 improve
- 📄 docs
- ✅ test
- 🔨 chore

## 技能
1. 对 git diff 信息进行全面、细致的分析，不放过任何关键细节。
2. 严格按照功能增加、问题修复、性能提升、代码重构等标准来判断改动类型。

## 限制
- 仅输出给定的可选回复，杜绝任何其他无关内容。
- 务必确保分析结果的准确性，杜绝误判。 
- 输出的 emoji 和英文单词之间必须有空格。
`;
      const response = await utils.fetchEventSource(ai.aiBaseUrl, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ai.aiApiKey}`,
        },
        method: "POST",
        body: JSON.stringify({
          model: "abab6.5s-chat",
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: diff },
          ],
          stream: true,
        }),
      });
      for await (const chunk of response) {
        const content = chunk.data?.choices?.at(0)?.message?.content ?? "";
        messagePrefix = messagePrefix + content;
      }
      if (messagePrefix.startsWith("-")) messagePrefix.slice(1);
      messagePrefix = messagePrefix.trim();
    })();
    await (async () => {
      const instructions = `
# 角色
你是一个专业的代码改动分析员，你将会收到所做改动的方向，和 git diff 的结果，你能够能够从这些内容中清晰、准确地描述本次的改动内容，并使用一句话，简练精准地描述本次改动的主要内容

## 技能
1. 仔细检查 git diff 的输出结果，代码的改动方向是 ${messagePrefix}。
2. 按照代码文件、修改的行号、修改的内容、修改的类型（增加、删除、修改）等方面进行详细描述。
3. 对于复杂的改动，尝试进行逻辑和功能上的解释。

## 示例：
- 修复内存泄漏，而不破坏转换测试
- 为弹窗组件编写类型
- 添加按钮、表格、表单组件
- 如果在 shallowReactive 中设置时已经是反应性的，则应该跟踪值
- 修复失效的链接
- 对评分功能进行重构

## 限制:
- 只专注于分析 git diff 结果中的代码改动，不涉及其他无关内容
- 直接输出描述内容，不要解释自己输出的内容是什么
- 输出的描述要清晰、准确、简洁、简要，结果输出的描述必须是一句话，不能长篇大论
- 直接描述重点，不要以诸如"本地代码改动主要以 XXX" 这种形式的内容开头
- 描述务必极端简洁，长度<20字
- 在结果中忽略文件路径/行号细节
- 禁止引导语（如"本次改动..."）
- 去除连接词/语法修饰
- 优先技术术语
- 必须确保结果是单行无换行的，拥有多个功能点时不要以列表形式输出，而是以逗号的形式进行描述
`;
      const response = await utils.fetchEventSource(ai.aiBaseUrl, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ai.aiApiKey}`,
        },
        method: "POST",
        body: JSON.stringify({
          model: "abab6.5s-chat",
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: diff },
          ],
          stream: true,
        }),
      });
      for await (const chunk of response) {
        const content = chunk.data?.choices?.at(0)?.message?.content ?? "";
        message = message + content;
      }
      message = message.trim();
    })();
    await (async () => {
      const instructions = `
##背景
你是一个好用的翻译助手。请将内容翻译成 ${cookbookToml.config.gitCommitLanguage ?? osLocale} 语言。用户发给你所有的话都是需要翻译的内容，你只需要回答翻译结果。翻译结果请符合 ${cookbookToml.config.gitCommitLanguage ?? osLocale} 语言的语言习惯。如果用户的输入和被翻译的语言相同，则严格地原样输出原文内容即可。

##注意事项
1. 确保专业术语的准确使用。
2. 对敏感词汇体现必要的敏感性。
3. 必须确保所有的单词都是小写的。
5. 严格保持回复的内容仅包含翻译后的内容本身，不包含任何多余的话，也不需要请求用户提出反馈。
`;
      const response = await utils.fetchEventSource(ai.aiBaseUrl, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ai.aiApiKey}`,
        },
        method: "POST",
        body: JSON.stringify({
          model: "abab6.5s-chat",
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: message },
          ],
          stream: true,
        }),
      });
      for await (const chunk of response) {
        const content = chunk.data?.choices?.at(0)?.message?.content ?? "";
        messageTranslated = messageTranslated + content;
      }
      messageTranslated = messageTranslated.trim();
      if (messageTranslated.endsWith(".")) messageTranslated = messageTranslated.slice(0, -1);
      if (messageTranslated.endsWith("!")) messageTranslated = messageTranslated.slice(0, -1);
      if (messageTranslated.endsWith("?")) messageTranslated = messageTranslated.slice(0, -1);
      if (messageTranslated.endsWith(";")) messageTranslated = messageTranslated.slice(0, -1);
    })();
    await utils.closeProgress("Generated!");
  }

  if (diff.length >= 65535) consola.warn("The diff result is too long, so this commit is no longer automatically generated using AI.");
  console.log("");
  const messageMixed = `${messagePrefix}: ${messageTranslated}`;
  let inputMessage = "";
  console.log(messageMixed);
  if (
    messageMixed.trim() !== ":" &&
    (await utils.inputBoolean({
      env: "is-it-adopted",
      message: "Is it adopted?",
    }))
  ) {
    inputMessage = messageMixed;
  } else {
    inputMessage = await utils.inputString({
      env: "message",
      message: "Enter commit message",
      placeholder: messageMixed,
    });
    if (!inputMessage || typeof inputMessage !== "string") exit(0);
  }

  await $`${{ raw: `git commit -m '${inputMessage.replaceAll("'", '"')}'` }}`;

  while (true) {
    try {
      await $`git push -u origin ${branch}`;

      break;
    } catch (error) {
      consola.error(error);
      if (
        !(await utils.inputBoolean({
          env: "retry",
          message: "I encountered the above error during push, do you want to try again? Usually the problem may be a network problem.",
        }))
      ) {
        exit(0);
      }
    }
  }

  consola.log("Attempting to pull remote code changes...");
  try {
    await $`git pull origin ${branch}:${branch}`;
  } catch (error) {
    consola.warn("Git has completed the commit and push, but the attempt to pull failed.");
  }
  consola.success(`Code synchronization completed for branch '${branch}'.`);
});
