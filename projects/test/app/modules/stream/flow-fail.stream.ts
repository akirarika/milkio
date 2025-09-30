import { createFlow, reject } from "milkio";
import type { MilkioContext } from "../../../.milkio/declares.ts";

export async function* handler(context: MilkioContext, params: {}): AsyncGenerator<{ counter: number; }, any, any> {
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
        flow.throw(reject("REQUEST_FAIL", "FAIL"));
    }, 2000);

    for await (const chunk of flow) yield chunk;
}