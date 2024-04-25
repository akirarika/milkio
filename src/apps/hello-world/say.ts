import type typia from "typia"
import { defineApi, defineApiTest } from "milkio"
import { useDrizzle } from "../../uses/drizzle"

/**
 * This is an API that greets you!
 * These ~~comments~~ will be presented by the **Cookbook**
 */
export const api = defineApi({
  meta: {
    //
  },
  async action(
    params: {
      by?: string & typia.tags.MinLength<2> & typia.tags.MaxLength<16>;
    },
    context
  ) {
    const message = `hello world! (by ${params.by})`

    // const drizzle = await useDrizzle()
    // await drizzle.insert(users).values({ name: params.by });
    // // eslint-disable-next-line no-console
    // console.log(await drizzle.query.users.findMany());
    // await drizzle.query.devices.findFirst();

    return {
      youSay: message
    }
  }
})

export const test = defineApiTest(api, [
  {
    name: "Basic",
    handler: async (test) => {
      const result = await test.execute(await test.randParams())
      if (!result.success) return test.reject("The result was not success")
    }
  }
])
