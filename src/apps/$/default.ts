import { defineApi, defineHttpHandler, envToNumber } from "milkio"
import { env } from "node:process"
import { milkio } from "../../../milkio"

export const api = defineApi({
  meta: {},
  async action(params: { commands: Array<string>; options: Record<string, string | true>; }, context) {
    context.detail.fullurl!.searchParams.get("say")
    const httpHandler = defineHttpHandler(await milkio)
    // if you are using Bun
    Bun.serve({
      port: envToNumber(env.PORT, 9000),
      fetch(request) {
        return httpHandler({ request })
      }
    })
  },
})