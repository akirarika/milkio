import type { MilkioContext } from "../../../../.milkio/declares.ts";

type Params = {
  a: number
  b: number
}

type Result = {
  sum: number
  product: number
}

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
  return {
    sum: params.a + params.b,
    product: params.a * params.b,
  };
}