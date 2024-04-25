export * from "./types"
import { failCode } from "./project/src/fail-code"
import type ApiSchema from "./project/generated/api-schema"
export { defineMiddleware } from "milkio-client"
import { defineMiddleware, defineMilkioClient } from "milkio-client"

const middlewareA = defineMiddleware({
  bootstrap() {
    // When your client is initialized
  },
  beforeExecute({ path, storage, params, headers }) {
    // Operation before sending your request
  },
  afterExecute({ path, result, storage }) {
    // Operation after sending your request
  },
})

export const createClient = defineMilkioClient<typeof ApiSchema, typeof failCode>([
  middlewareA()
])

export const FailCode = failCode