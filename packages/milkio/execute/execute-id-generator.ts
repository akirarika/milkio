import { __createId } from "../utils/create-id.ts";

export type ExecuteIdGenerator = (request?: Request) => string | Promise<string>;

export function defineDefaultExecuteIdGenerator() {
  return __createId;
}
