import { defineCookbookCommand } from '@milkio/cookbook-command'
import { gitUserCheck } from '../utils/git-user-check'
import { $ } from 'bun'
import { exit } from 'node:process'
import consola from 'consola'
import * as osLocale from 'os-locale'

export default await defineCookbookCommand(async (utils) => {
  const cookbookToml = await utils.getCookbookToml();
  await gitUserCheck();

  let branch;
  try {
    branch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();
  } catch (error) {
    branch = await utils.inputString({
      env: 'branch',
      message: 'Enter Git branch name',
      placeholder: 'feature/your-feature-name'
    })
  }

  await $`git add --all`;
  consola.start("Checking git changes..");
  const diff = (await $`git diff --staged`.text()).trim();

  if (/$\s*^/g.test(diff)) {
    consola.success("No staged changes detected");
    exit(0);
  }

  const canUseAI = await utils.canUseAI();

  while (true) {
    try {
      let message: string = "";
      if (canUseAI && diff.length < 65535) {
        const { client, model } = await utils.useAI();
        consola.start(`Generating AI commit message (${model})..`);
        await (async () => {
          let instructions = `
# 角色
你是一位专业的 git diff 分析员，能够精准接收用户提供的 git diff 信息，并根据其内容准确判断主要改动类型。从以下可选回复中，选择其中之一进行回复。可选回复由 emoji 和描述文字组成。

# 可选回复

- ✨ feat
- 🧊 fix
- 🦄 improve
- 🧩 refact
- 📄 docs
- ✅ test
- 🔧 refactor
- 🔨 chore

## 技能
1. 对 git diff 信息进行全面、细致的分析，不放过任何关键细节。
2. 严格按照功能增加、问题修复、性能提升、代码重构等标准来判断改动类型。

## 限制
- 仅输出给定的可选回复，杜绝任何其他无关内容。
- 务必确保分析结果的准确性，杜绝误判。 
# 角色
你是一个专业严谨的代码改动分析员，能够精准解析 git diff 结果并用结构化 emoji 格式描述核心改动
`;
          const response = await client.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: `${instructions}` },
              { role: 'user', content: `${diff}` }
            ],
            stream: true,
          });
          for await (const chunk of response) {
            process.stdout.write((chunk.choices[0].delta as any).content || (chunk.choices[0].delta as any).reasoning_content);
            const content = (chunk.choices[0].delta as any).content;
            message = message + content;
          }
          if (message.startsWith('-')) message.slice(1);
          message = message.trim();
        })();
        await (async () => {
          let instructions = `
# 角色
你是一个专业的代码改动分析员，你将会收到所做改动的方向，和 git diff 的结果，你能够能够从这些内容中清晰、准确地描述本次的改动内容，并使用一句话，简练精准地描述本次改动的主要内容

## 技能
1. 仔细检查 git diff 的输出结果，代码的改动方向是 ${message}。
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
- 必须确保结果是单行无换行的，也不能以列表或分号的形式进行描述
- 输出的内容，必须是使用 ${cookbookToml.config.gitCommitLanguage ?? osLocale} 语言！这非常重要
`;
          const response = await client.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: `${instructions}` },
              { role: 'user', content: `${diff}` }
            ],
            stream: true,
          });
          message = message + `: `;
          process.stdout.write(`: `);
          for await (const chunk of response) {
            process.stdout.write((chunk.choices[0].delta as any).content || (chunk.choices[0].delta as any).reasoning_content);
            const content = (chunk.choices[0].delta as any).content;
            message = message + content;
          }
          message = message.trim();
        })();
      }


      if (diff.length >= 65535) consola.warn(`The diff result is too long, so this commit is no longer automatically generated using AI.`)
      console.log('')
      let inputMessage = await utils.inputString({
        env: "message",
        message: "Enter commit message",
        placeholder: message,
      })
      if (!inputMessage || typeof inputMessage !== 'string') inputMessage = message;

      await $`${{ raw: `git commit -m '${inputMessage.replaceAll("'", '"')}'` }}`;
      await $`git push -u origin ${branch}`;
      break;
    } catch (error) {
      consola.error(error);
      if (!await utils.inputBoolean({
        env: 'retry',
        message: 'I encountered the above error during push, do you want to try again? Usually the problem may be a network problem.'
      })) {
        exit(0);
      }
    }
  }
})