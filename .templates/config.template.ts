import { createTemplate } from '@milkio/cookbook-template'
import { join } from 'node:path'

await createTemplate(async (tools) => {
  return {
    path: join(tools.directory(), `${tools.hyphen(tools.name())}.action.ts`),
    content: `
import { config } from "milkio";

/**
 * ${tools.name()}
 */
export default config(
  async (env) => ({
    // your config here
  }),
  {
    development: (env) => ({
      // different values are used in different environments
    }),
  },
);
`.trim(),
  }
})
