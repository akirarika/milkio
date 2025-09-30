import { createFlow } from "milkio";
import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";


export const meta: MilkioMeta = {};

export async function* handler(context: MilkioContext, params: {}): AsyncGenerator<{ counter: number }> {
    const flow = createFlow<{ counter: number }>();

    setTimeout(() => {
        flow.emit({ counter: 500 });
    }, 500);
    setTimeout(() => {
        flow.emit({ counter: 1000 });
    }, 1000);
    setTimeout(() => {
        flow.emit({ counter: 1500 });
    }, 1500);
    setTimeout(() => {
        flow.return();
    }, 2000);

    for await (const chunk of flow) yield chunk;
};