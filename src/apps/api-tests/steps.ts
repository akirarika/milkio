import { defineApi, defineApiTest, reject, type Remove$ } from "milkio";
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
		const result = await context
			/**
			 * Step 1
			 */
			.step(async (stages) => {
				const message1 = `Step 1`;

				return { message1 };
			})
			/**
			 * Step 2
			 */
			.step(async (stage) => {
				const $message2 = `Step 2`;

				return { $message2 };
			})
			/**
			 * Step 3
			 */
			.step(async (stage) => {
				if (!stage.message1) throw reject("INTERNAL_SERVER_ERROR", undefined);
				if (!stage.$message2) throw reject("INTERNAL_SERVER_ERROR", undefined);
				return {};
			})
			.run();

		return result;
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

			console.warn(result);

			if (!result.success) throw test.reject("The result was not success");
			if (result.data.message1 !== "Step 1") throw test.reject("message1 is not Step 1");
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			if ((result.data as any).$message2 === "Step 2") throw test.reject("message2 is Step 2");
		},
	},
]);
