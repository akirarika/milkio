import type { MilkioContext } from "../../../.milkio/declares.ts";

export const meta = {
    typeSafety: false as const,
};

type Params = { type: "uint8array" | "arraybuffer" | "blob" };

type Result = { success: boolean };

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
    const text = "Hello, Binary World!";
    const encoder = new TextEncoder();
    const uint8 = encoder.encode(text);

    // Only set response body if context.http is available (not IPC proxy)
    if (!(context as any).http?.notFound) {
        if (params.type === "uint8array") {
            context.http.response.body = uint8;
            context.http.response.headers["Content-Type"] = "application/octet-stream";
        } else if (params.type === "arraybuffer") {
            context.http.response.body = uint8.buffer;
            context.http.response.headers["Content-Type"] = "application/octet-stream";
        } else if (params.type === "blob") {
            context.http.response.body = new Blob([uint8]);
            context.http.response.headers["Content-Type"] = "application/octet-stream";
        }
    }

    return { success: true };
}
