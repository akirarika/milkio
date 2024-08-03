import { createTemplate } from "milkio-template";
import { join } from "node:path";

await createTemplate(async (tools) => {
	return {
		path: join(tools.directory(), `${tools.hyphen(tools.name())}.ts`),
		content: `
import { defineUse } from "milkio"

export const use${tools.hump(tools.name())} = defineUse(() => {
  const ${tools.camel(tools.name())} = {
    async say() {
      return 'hello world'
    }
    // ..
  }
  return ${tools.camel(tools.name())}
})
`.trim(),
	};
});
