import { expect, test } from "vitest";

const BASE_URL = "http://localhost:9000";

test.sequential("binary response with Uint8Array via HTTP", async () => {
    const res = await fetch(`${BASE_URL}/hello-world/binary-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "uint8array" }),
    });
    expect(res.ok).toBe(true);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    const buffer = await res.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    expect(text).toBe("Hello, Binary World!");
});

test.sequential("binary response with ArrayBuffer via HTTP", async () => {
    const res = await fetch(`${BASE_URL}/hello-world/binary-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "arraybuffer" }),
    });
    expect(res.ok).toBe(true);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    const buffer = await res.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    expect(text).toBe("Hello, Binary World!");
});

test.sequential("binary response with Blob via HTTP", async () => {
    const res = await fetch(`${BASE_URL}/hello-world/binary-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "blob" }),
    });
    expect(res.ok).toBe(true);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    const buffer = await res.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    expect(text).toBe("Hello, Binary World!");
});

test.sequential("standard Request object is used (headers.get works)", async () => {
    const res = await fetch(`${BASE_URL}/hello-world/hello`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Custom-Header": "test-value",
        },
        body: JSON.stringify({ a: "hello", b: 1 }),
    });
    expect(res.ok).toBe(true);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    const data = await res.json() as any;
    expect(data.success).toBe(true);
});
