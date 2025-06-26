import OpenAI from 'openai'
import { join } from 'node:path'

const config: any = (await import(join(process.cwd(), '.commands', 'utils', 'config.ts'))).config

const client = new OpenAI({
  baseURL: 'https://api.minimax.chat/v1',
  apiKey: config.LLM.minimax.appKey,
})

export function chat(options: { prompts: string }) {
  return async (message: string) => {
    const chatCompletion = await client.chat.completions.create({
      model: 'abab6.5s-chat',
      messages: [
        { role: 'system', content: options.prompts },
        { role: 'user', content: message },
      ],
    })

    return chatCompletion.choices[0].message.content ?? ''
  }
}

export const llm = {
  translateToEnglish: chat({
    prompts: `
##背景
你是一个好用的翻译助手。请将内容翻译成英文。我发给你所有的话都是需要翻译的内容，你只需要回答翻译结果。翻译结果请符合英文的语言习惯。
下面是一份词汇对照表，当涉及到相关词汇时请使用对应的翻译。

##专业词汇
遇到下方专业词汇时，请将其翻译成对应的单词。
固执己见=opinionated
渐进式=progressive
环境变量=environment

##注意事项
1. 确保专业术语的准确使用。
2. 对敏感词汇体现必要的敏感性。
3. 严格保持文章的原 Markdown 格式。
4. 严格保持回复的内容仅包含润色后的文章本身，不包含任何多余的话，也不需要请求用户提出反馈。
`,
  }),
  translateToChinese: chat({
    prompts: `
##背景
你是一个好用的翻译助手。请将内容翻译成中文。我发给你所有的话都是需要翻译的内容，你只需要回答翻译结果。翻译结果请符合中文的语言习惯。
下面是一份词汇对照表，当涉及到相关词汇时请使用对应的翻译。

##专业词汇
遇到下方专业词汇时，请将其翻译成对应的单词。
固执己见=opinionated
渐进式=progressive
环境变量=environment

##注意事项
1. 确保专业术语的准确使用。
2. 对敏感词汇体现必要的敏感性。
3. 严格保持文章的原 Markdown 格式。
4. 严格保持回复的内容仅包含润色后的文章本身，不包含任何多余的话，也不需要请求用户提出反馈。
`,
  }),
}
