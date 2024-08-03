import { defineApi, defineApiTest } from "milkio";
import type typia from "typia";

/**
 * This is an API that greets you!
 * 🌟 These ~~comments~~ will be presented by the **Cookbook**
 */
export const api = defineApi({
	meta: {
		//
	},
	async *action(
		params: {
			by: string & typia.tags.MinLength<2> & typia.tags.MaxLength<16>;
		},
		context,
	) {
		const message = `hello world! (by ${params.by})`;

		yield {
			youSay: message,
		};
	},
});

export const test = defineApiTest(api, [
	{
		name: "Basic",
		handler: async (test) => {
			const params = await test.randParams();
			const { stream, getResult } = await test.executeStream({ params });
			for await (const chunk of stream) {
				console.log("chunk:", chunk);
			}
			const result = getResult(); // getResult 一定要在流读取完成后调用
			if (!result.success) throw test.reject(`这里是你的 API 测试失败的原因`);
		},
	},
]);
