/* eslint-disable no-console */
import { defineMiddleware } from "milkio"

/**
 * (ECAMPLE) HTTP IO Console Log
 * Print logs when receiving requests and making responses.
 * Note: The log function provided by Milkio is not used here, but directly printed on the console.
 */
export const httpIOConsoleLog = defineMiddleware({
  afterHTTPRequest: async (headers, detail) => {
    console.log("🍋 Request In: " + detail.fullurl.toString())
  },
  beforeHTTPResponse: async (headers, detail) => {
    console.log("🍋 Response Out: " + detail.fullurl.toString())
  }
})
