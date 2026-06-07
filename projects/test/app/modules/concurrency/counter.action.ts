import type { MilkioContext } from "../../../.milkio/declares.ts";

const counter = { value: 0 };

type Params = {
    incrementBy: number
    delayMs: number
    reset: boolean
}

type Result = {
    beforeValue: number
    afterValue: number
}

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
    if (params.reset) {
        counter.value = 0;
    }
    const beforeValue = counter.value;
    await new Promise((resolve) => setTimeout(resolve, params.delayMs));
    counter.value += params.incrementBy;
    const afterValue = counter.value;
    return { beforeValue, afterValue };
}