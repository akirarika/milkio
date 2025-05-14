import { __createId } from "../utils/create-id.ts";

export type ExecuteIdGenerator = (headers?: Headers) => string | Promise<string>;

export function defineDefaultExecuteIdGenerator() {
  return __createId;
}
