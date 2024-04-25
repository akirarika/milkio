import { defineHttpHandler, envToNumber } from "milkio"
import { env } from "node:process"
import { milkio } from "./milkio"

async function serve() {
  const httpHandler = defineHttpHandler(await milkio)
  // if you are using Bun
  Bun.serve({
    port: envToNumber(env.PORT, 9000),
    fetch(request) {
      return httpHandler({ request })
    }
  })
}

serve()