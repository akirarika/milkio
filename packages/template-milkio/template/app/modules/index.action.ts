import type { MilkioContext, MilkioMeta } from '../../.milkio/declares.ts';

export const meta: MilkioMeta = {};

type Params = {};

type Result = { message: string };

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
    const message = 'Hello world! UwU';

    return {
        message,
    };
}
