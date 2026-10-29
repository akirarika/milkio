import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

export async function handler(context: MilkioContext, request: Request): Promise<Response> {
    return new Response(JSON.stringify({ path: context.http.path.string, url: request.url, prefix: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
