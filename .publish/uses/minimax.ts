import { config } from "../config.ts";

export const useMinimax = () => {
	const minimax = {
		async fetch(body: Record<any, any>) {
			const minimaxConfig = config.LLM.minimax;
			const url = `https://api.minimax.chat/v1/text/chatcompletion_pro?GroupId=${minimaxConfig.groupId}`;

			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `${minimaxConfig.appKey}`,
				},
				body: JSON.stringify(body),
			});

			return (await response.json()) as any;
		},
		async translate(message: string) {
			const response = await minimax.fetch({
				model: "abab6.5-chat",
				tokens_to_generate: 4096,
				mask_sensitive_info: false,
				reply_constraints: { sender_type: "BOT", sender_name: "翻译助手" },
				messages: [{ sender_type: "USER", sender_name: "用户", text: message }],
				bot_setting: [
					{
						bot_name: "翻译助手",
						content: "你是一个好用的翻译助手。请将我的中文翻译成英文，将所有非中文的翻译成中文。我发给你所有的话都是需要翻译的内容，你只需要回答翻译结果。翻译结果请符合中文的语言习惯。",
					},
				],
			});

			return response?.choices?.at(-1)?.messages?.at(-1)?.text;
		},
		async translateToEnglish(message: string) {
			const response = await minimax.fetch({
				model: "abab6.5-chat",
				tokens_to_generate: 4096,
				mask_sensitive_info: false,
				reply_constraints: { sender_type: "BOT", sender_name: "翻译助手" },
				messages: [{ sender_type: "USER", sender_name: "用户", text: message }],
				bot_setting: [
					{
						bot_name: "翻译助手",
						content: "你是一个好用的翻译助手。请将我的中文翻译成英文。我发给你所有的话都是需要翻译的内容，你只需要回答翻译结果。翻译结果请符合英文的语言习惯。",
					},
				],
			});

			return response?.choices?.at(-1)?.messages?.at(-1)?.text;
		},
		async translateDoc(message: string, lang: "中文" | "英文") {
			const langTo = lang === "中文" ? "英文" : "中文";
			const response = await minimax.fetch({
				model: "abab6-chat",
				tokens_to_generate: 1024,
				mask_sensitive_info: false,
				reply_constraints: { sender_type: "BOT", sender_name: "翻译助手" },
				messages: [{ sender_type: "USER", sender_name: "用户", text: message }],
				bot_setting: [
					{
						bot_name: "翻译助手",
						content: `你是一个好用的翻译助手。请将我的${lang}文档翻译成${langTo}文档，文档都是使用 Markdown 编写的。
下面是一份词汇对照表，当涉及到相关词汇时，请使用对应的翻译。
---
环境变量=environment
令人愉快=pleasant
---
请保持翻译后的文档格式和原文一致。我发给你所有的话都是需要翻译的${lang}内容，你只需要回答翻译为${langTo}的结果。翻译结果请符合${langTo}的语言习惯。
`,
					},
				],
			});

			return response?.choices?.at(-1)?.messages?.at(-1)?.text;
		},
		// ..
	};
	return minimax;
};
