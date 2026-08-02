import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

export async function handler(context: MilkioContext, request: Request): Promise<Response> {
    const encoder = new TextEncoder();
    const data = encoder.encode("Hello, Raw Binary World!");

    return new Response(data, {
        status: 200,
        headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": String(data.length),
        },
    });
}
