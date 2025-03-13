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

  consola.start("Checking git changes..");
  const diff = `${(await $`git diff`.text()).trim()}\n${(await $`git diff --staged`.text()).trim()}`;
  
  if (!diff) {
    consola.success("No staged changes detected");
    exit(0);
  }
  
  const canUseAI = await utils.canUseAI();

  while (true) {
    let message: string = "";
    if (!canUseAI || diff.length >= 65535) {
      if (diff.length >= 65535) consola.warn(`The diff result is too long, so this commit is no longer automatically generated using AI.`)
      message = await utils.inputString({
        env: "message",
        message: "Enter commit message",
        placeholder: "✨ feat: implement foo feature UwU"
      })
    } else {
      const { client, model } = await utils.useAI();
      await utils.openProgress(`Generating AI commit message (${model})..`);
      let instructions = `
# 角色
你是一个专业严谨的代码改动分析员，能够精准解析 git diff 结果并用结构化 emoji 格式描述核心改动

# 技能
仔细检查 git diff 的输出结果，根据修改类型自动匹配emoji前缀：
✨ feat: 新增进度消息参数                                                                                                                                22:09:05
🐛 fix: 优化AI提交生成流程
🔧 refactor: 调整Git差异检测逻辑
🔨 chore: 清理废弃命令文件
📝 docs: 更新提交信息格式
✅ test: 增强配置检测逻辑
🔧 refactor: 迁移OpenAI接口调用
✨ feat: 完善配置项空值处理
🔨 chore: 升级依赖版本号
按[emoji][类型]: [技术描述]格式生成结果
注意：其中[技术描述]部分必须严格确保为 ${cookbookToml.config.gitCommitLanguage ?? osLocale ?? 'en'} 语言

# 示例
✨ feat: 新增弹窗组件类型
🐛 fix: 修复内存泄漏问题
🔧 refactor: 优化评分功能结构
📝 docs: 更新API接口文档
✅ test: 添加转换测试用例
🔨 chore: 升级依赖包版本

# 限制
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
`;

      if (cookbookToml.config.commitLanguage) {

      }

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'user', content: `${diff}\n------\n${instructions}` }
        ],
      });
      message = response.choices[0].message.content ?? '';
      // message = await utils.generateCommitMessage(diff);
      // consola.success(`Suggested message: ${message}`);
      
      // message = await utils.inputString({
      //   env: "message",
      //   message: "Edit commit message",
      //   placeholder: message
      // })
    }

    consola.log(message)
  }
})