import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {
  typeSafety: false,
};

type Params = {
  username: string
  password: string
  role: 'admin' | 'user' | 'guest'
  age: number
}

type Result = {
  username: string
  role: string
  age: number
  receivedFields: string[]
}

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
  return {
    username: params.username,
    role: params.role,
    age: params.age,
    receivedFields: Object.keys(params),
  };
}
