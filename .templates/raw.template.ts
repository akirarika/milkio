import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

export async function handler(context: MilkioContext, request: Request): Promise<Response> {
    const body = await request.text();

    return new Response(JSON.stringify({ received: body }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
