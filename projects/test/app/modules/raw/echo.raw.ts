import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

export async function handler(context: MilkioContext, request: Request): Promise<Response> {
    // Read the request body as JSON and echo it back
    const body = await request.text();
    let data: any = {};
    if (body) {
        try {
            data = JSON.parse(body);
        } catch {
            data = { raw: body };
        }
    }

    return new Response(JSON.stringify({
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
        body: data,
        routeType: context.routeType,
        echo: true,
    }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
