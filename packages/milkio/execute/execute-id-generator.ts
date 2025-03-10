import { createId } from '../utils/create-id'

export type ExecuteIdGenerator = (request?: Request) => string | Promise<string>

export function defineDefaultExecuteIdGenerator() {
  return createId
}
