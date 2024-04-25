import { defineApi, defineApiTest, reject } from "milkio"

export const api = defineApi({
  meta: {
    deddos: "default",
    permissions: {
      mode: "full-open"
    },
    allowMethods: ["GET", "POST"]
  },
  async action(
    params: undefined,
    context
  ) {
    throw reject('BUSINESS_FAIL', 'asdassad')
    const message = `hello world!`

    return {
      say: message
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