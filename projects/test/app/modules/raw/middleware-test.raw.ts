import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

export async function handler(context: MilkioContext, request: Request): Promise<Response> {
    // Verify that milkio:executeBefore fired for this raw route.
    // The foo.handler.ts bootstrap sets context.say = () => 'hello world'
    // in its milkio:executeBefore hook. If the hook didn't fire, say will be undefined.
    const sayResult = typeof (context as any).say === "function" ? (context as any).say() : null;

    return new Response(JSON.stringify({
        middlewareFired: sayResult !== null,
        sayResult,
        path: context.path,
        routeType: context.routeType,
        hasExecuteId: !!context.executeId,
        hasLogger: !!context.logger,
    }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
