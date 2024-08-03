import { createTemplate } from "milkio-template";
import { join } from "node:path";

await createTemplate(async (tools) => {
	return {
		path: join(tools.directory(), `${tools.hyphen(tools.name())}.ts`),
		content: `
import { defineApi, defineApiTest } from "milkio"

/**
 * ${tools.name()}
 */
export const api = defineApi({
  meta: {},
  async action(params: { /* your params.. */ }, context) {
    const message = \`hello world!\`

    return {
      say: message
    }
  }
})

export const test = defineApiTest(api, [
  {
    name: "Basic",
    handler: async (test) => {
      const result = await test.client.execute({ params: await test.randParams() })
      test.log("result", result)
      if (!result.success) return test.reject(\`The result was not success\`)
    }
  }
])
`.trim(),
	};
});
