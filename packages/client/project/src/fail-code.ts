import type { MilkioFailCode } from "milkio"

export const failCode = {
  NETWORK_ERROR: () => "Network Error",
  INTERNAL_SERVER_ERROR: () => "Internal Server Error",
  NOT_FOUND: () => "Not Found",
  NOT_ALLOW_METHOD: () => "Not Allow Method",
  TYPE_SAFE_ERROR: (params: { path: string; expected: string; value: string }) => `Parameter Error: The current value is '${params.value}', which does not meet '${params.expected}' requirements`,
  BUSINESS_FAIL: (message: string) => `${message}`
  // You can add your own mistakes here
  // ...
} satisfies MilkioFailCode
