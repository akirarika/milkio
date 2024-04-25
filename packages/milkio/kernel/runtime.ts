import { type ExecuteId } from ".."

export const runtime = {
  execute: {
    executeIds: new Set<ExecuteId>()
  },
  maxRunningTimeout: {
    enable: false,
    expectedEndedAt: 0
  }
}
