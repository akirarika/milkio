import type { MilkioContext, MilkioMeta } from "../../../.milkio/declares.ts";

export const meta: MilkioMeta = {};

/**
 * Simulates an OpenAI SSE passthrough.
 *
 * Instead of calling a real upstream, this handler generates SSE frames
 * directly to demonstrate that raw handlers can produce streaming responses.
 * In a real OpenAI proxy, you would do:
 *
 *   const upstream = await fetch("https://api.openai.com/v1/chat/completions", { ... });
 *   return new Response(upstream.body, {
 *     status: upstream.status,
 *     headers: { "Content-Type": "text/event-stream", ... },
 *   });
 */
export async function handler(context: MilkioContext, request: Request): Promise<Response> {
    const body = await request.text();
    let chunks: number = 3;
    if (body) {
        try {
            const parsed = JSON.parse(body);
            if (typeof parsed.chunks === "number") chunks = parsed.chunks;
        } catch {}
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            for (let i = 0; i < chunks; i++) {
                const data = JSON.stringify({ chunk: i, text: `Hello ${i}` });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                // Simulate upstream latency
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
