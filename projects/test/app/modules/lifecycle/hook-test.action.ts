import type { MilkioContext } from "../../../.milkio/declares.ts";

type Result = {
  beforeHook: string
  executeId: string
  path: string
}

export async function handler(context: MilkioContext, params: {}): Promise<Result> {
  return {
    beforeHook: (context as any).hookData ?? 'not-set',
    executeId: context.executeId,
    path: context.path,
  };
}