import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

export async function handler(context: MilkioContext, request: Request): Promise<Response> {
    const body = await request.text();
    let params: any = {};
    if (body) {
        try { params = JSON.parse(body); } catch {}
    }

    const status = typeof params.status === "number" ? params.status : 200;
    const headerName = typeof params.headerName === "string" ? params.headerName : "X-Custom";
    const headerValue = typeof params.headerValue === "string" ? params.headerValue : "raw-value";

    return new Response(JSON.stringify({ status, custom: true }), {
        status,
        headers: {
            "Content-Type": "application/json",
            [headerName]: headerValue,
        },
    });
}
