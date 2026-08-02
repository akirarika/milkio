import { expect, test } from "vitest";

const BASE_URL = "http://localhost:9000";

// ============ echo.raw.ts ============

test.sequential("raw echo - returns JSON with request info", async () => {
    const res = await fetch(`${BASE_URL}/raw/echo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hello: "world", num: 42 }),
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");

    const data = await res.json() as any;
    expect(data.echo).toBe(true);
    expect(data.method).toBe("POST");
    expect(data.body).toEqual({ hello: "world", num: 42 });
});

test.sequential("raw echo - GET request with no body", async () => {
    const res = await fetch(`${BASE_URL}/raw/echo`, {
        method: "GET",
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    expect(data.method).toBe("GET");
    expect(data.body).toEqual({});
});

test.sequential("raw echo - non-JSON body is preserved as raw string", async () => {
    const res = await fetch(`${BASE_URL}/raw/echo`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "plain text body",
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    expect(data.body).toEqual({ raw: "plain text body" });
});

// ============ binary.raw.ts ============

test.sequential("raw binary - returns octet-stream", async () => {
    const res = await fetch(`${BASE_URL}/raw/binary`, {
        method: "POST",
    });
    expect(res.ok).toBe(true);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");

    const buffer = await res.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    expect(text).toBe("Hello, Raw Binary World!");
});

// ============ custom-status.raw.ts ============

test.sequential("raw custom status - 200 by default", async () => {
    const res = await fetch(`${BASE_URL}/raw/custom-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Custom")).toBe("raw-value");
    const data = await res.json() as any;
    expect(data.custom).toBe(true);
    expect(data.status).toBe(200);
});

test.sequential("raw custom status - 404 with custom headers", async () => {
    const res = await fetch(`${BASE_URL}/raw/custom-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: 404, headerName: "X-Test", headerValue: "not-found" }),
    });
    expect(res.status).toBe(404);
    expect(res.headers.get("X-Test")).toBe("not-found");
    const data = await res.json() as any;
    expect(data.status).toBe(404);
});

test.sequential("raw custom status - 500 error code", async () => {
    const res = await fetch(`${BASE_URL}/raw/custom-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: 500 }),
    });
    expect(res.status).toBe(500);
});

// ============ sse-passthrough.raw.ts ============

test.sequential("raw SSE - streams chunks as text/event-stream", async () => {
    const res = await fetch(`${BASE_URL}/raw/sse-passthrough`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunks: 5 }),
    });
    expect(res.ok).toBe(true);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));

    // Should have 5 data chunks + 1 [DONE]
    expect(lines.length).toBe(6);
    expect(lines[0]).toContain("Hello 0");
    expect(lines[4]).toContain("Hello 4");
    expect(lines[5]).toBe("data: [DONE]");

    // Verify each chunk parses as JSON
    for (let i = 0; i < 5; i++) {
        const parsed = JSON.parse(lines[i].slice(6));
        expect(parsed.chunk).toBe(i);
        expect(parsed.text).toBe(`Hello ${i}`);
    }
});

test.sequential("raw SSE - default 3 chunks", async () => {
    const res = await fetch(`${BASE_URL}/raw/sse-passthrough`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    expect(res.ok).toBe(true);
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));
    // 3 data chunks + 1 [DONE]
    expect(lines.length).toBe(4);
});

test.sequential("raw SSE - works with no body", async () => {
    const res = await fetch(`${BASE_URL}/raw/sse-passthrough`, {
        method: "GET",
    });
    expect(res.ok).toBe(true);
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));
    expect(lines.length).toBe(4); // 3 + [DONE]
    expect(lines[3]).toBe("data: [DONE]");
});

// ============ URL control ============

test.sequential("raw route - URL has no suffix (clean path)", async () => {
    // The URL should be exactly /raw/echo, not /raw/echo~ or /raw/echo+
    const res = await fetch(`${BASE_URL}/raw/echo`, {
        method: "POST",
        body: JSON.stringify({ test: "url" }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    expect(data.url).toContain("/raw/echo");
    // Ensure no suffix in the URL
    expect(data.url).not.toContain("~");
    expect(data.url).not.toContain("+");
});

// ============ Non-existent raw route ============

test.sequential("raw route - 404 for non-existent raw path", async () => {
    const res = await fetch(`${BASE_URL}/raw/nonexistent`, {
        method: "POST",
    });
    expect(res.status).toBe(200); // milkio returns 200 with success:false in body
    const data = await res.json() as any;
    expect(data.success).toBe(false);
    expect(data.code).toBe("NOT_FOUND");
});

// ============ Action routes still work alongside raw routes ============

test.sequential("action routes still work alongside raw routes", async () => {
    const res = await fetch(`${BASE_URL}/hello-world/hello`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: "test", b: 1 }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.data.count).toBe(3);
});

// ============ Raw handler can use context ============

test.sequential("raw handler has access to context", async () => {
    // The echo handler reads request.headers, which includes cookies etc.
    // We verify context is properly constructed by checking the echoed headers.
    const res = await fetch(`${BASE_URL}/raw/echo`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Context-Test": "context-works",
        },
        body: JSON.stringify({}),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    expect(data.headers["x-context-test"]).toBe("context-works");
});

// ============ CORS headers on raw responses ============

test.sequential("raw route - CORS headers applied when Origin present", async () => {
    const res = await fetch(`${BASE_URL}/raw/echo`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Origin": "http://localhost:3000",
        },
        body: JSON.stringify({}),
    });
    expect(res.ok).toBe(true);
    // CORS header should be present
    const accessControl = res.headers.get("Access-Control-Allow-Origin");
    expect(accessControl).toBeTruthy();
});

// ============ Middleware / event compatibility ============
// Raw routes must trigger the same lifecycle events as actions:
//   milkio:httpRequest, milkio:executeBefore, milkio:executeAfter, milkio:httpResponse
// The foo.handler.ts bootstrap hooks into these events and:
//   - executeBefore: sets context.say = () => 'hello world'
//   - httpRequest / httpResponse: throw if event fields are missing
// If any event doesn't fire or is missing required fields, the request will fail.

test.sequential("raw route - milkio:executeBefore fires and injects context", async () => {
    const res = await fetch(`${BASE_URL}/raw/middleware-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    // foo.handler.ts sets context.say in milkio:executeBefore
    expect(data.middlewareFired).toBe(true);
    expect(data.sayResult).toBe("hello world");
});

test.sequential("raw route - context has path, executeId, and logger", async () => {
    const res = await fetch(`${BASE_URL}/raw/middleware-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    expect(data.path).toBe("/raw/middleware-test");
    expect(data.hasExecuteId).toBe(true);
    expect(data.hasLogger).toBe(true);
});

test.sequential("raw route - milkio:httpRequest and milkio:httpResponse fire without error", async () => {
    // foo.handler.ts registers handlers for milkio:httpRequest and milkio:httpResponse
    // that throw reject('REQUEST_FAIL', ...) if any required event field is missing.
    // A successful 200 response proves both events fired with complete fields.
    const res = await fetch(`${BASE_URL}/raw/middleware-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    // If httpRequest/httpResponse handlers threw, we'd get a 500 or error body
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.middlewareFired).toBe(true);
});

// ============ context.routeType ============
// context.routeType lets middleware distinguish action / stream / raw requests
// and skip raw routes when they expect plain-object results (raw returns a Response).

test.sequential("raw route - context.routeType is 'raw'", async () => {
    const res = await fetch(`${BASE_URL}/raw/middleware-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    expect(data.routeType).toBe("raw");
});

test.sequential("raw echo - context.routeType is 'raw'", async () => {
    const res = await fetch(`${BASE_URL}/raw/echo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    expect(data.routeType).toBe("raw");
});

test.sequential("action route - context.routeType is 'action'", async () => {
    const res = await fetch(`${BASE_URL}/context/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.data.routeType).toBe("action");
});

test.sequential("stream route - context.routeType is 'stream'", async () => {
    const res = await fetch(`${BASE_URL}/context/route-type~`, {
        method: "POST",
        headers: { "Accept": "text/event-stream", "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    expect(res.ok).toBe(true);
    const text = await res.text();
    // Stream format: data:@{...}\n\n data:[null,{"routeType":"stream"}]\n\n
    const lines = text.split("\n").filter((l) => l.startsWith("data:["));
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0].slice(5));
    expect(parsed[1].routeType).toBe("stream");
});
