import type { MilkioContext } from "../../../.milkio/declares.ts";

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
}

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
  if (params.age < 0 || params.age > 150) {
    throw context.reject('REQUEST_FAIL', 'Invalid age');
  }

  if (!['admin', 'user', 'guest'].includes(params.role)) {
    throw context.reject('REQUEST_FAIL', 'Invalid role');
  }

  return {
    username: params.username,
    role: params.role,
    age: params.age,
  };
}