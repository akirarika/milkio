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
	async action(
		params: {
			by: string & typia.tags.MinLength<2> & typia.tags.MaxLength<16>;
		},
		context,
	) {
		const message = `hello world! (by ${params.by})`;

		return {
			youSay: message,
		};
	},
});

export const test = defineApiTest(api, [
	{
		name: "Basic",
		handler: async (test) => {
			const result = await test.client.execute({
				params: {
					by: "milkio",
				},
			});

			if (!result.success) throw test.reject("The result was not success");
		},
	},
]);
