/* eslint-disable no-console */
import { defineApi, defineApiTest } from "milkio"

export const api = defineApi({
  meta: {},
  async action(
    params: {
      commands: Array<string>;
      options: Record<string, string | true>;
    },
    context
  ) {
    return params
  },
})