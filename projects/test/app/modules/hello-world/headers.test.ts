import { expect, test } from "vitest";
import { stargate } from "../../../test.ts";

const BASE_URL = "http://localhost:9000";

test.sequential("context.http.request.headers.get() reads custom request headers", async () => {
    const res = await fetch(`${BASE_URL}/hello-world/headers`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Custom-Token": "abc123",
            "X-User-Id": "42",
        },
        body: JSON.stringify({
            readHeaders: ["X-Custom-Token", "X-User-Id", "X-Not-Exist"],
        }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    expect(data.data.read["X-Custom-Token"]).toBe("abc123");
    expect(data.data.read["X-User-Id"]).toBe("42");
    expect(data.data.read["X-Not-Exist"]).toBeNull();
});

test.sequential("headers.get() is case-insensitive (HTTP spec)", async () => {
    const res = await fetch(`${BASE_URL}/hello-world/headers`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-lowercase-header": "value-from-lowercase",
        },
        body: JSON.stringify({
            readHeaders: ["X-LOWERCASE-HEADER", "x-lowercase-header", "X-Lowercase-Header"],
        }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    expect(data.data.read["X-LOWERCASE-HEADER"]).toBe("value-from-lowercase");
    expect(data.data.read["x-lowercase-header"]).toBe("value-from-lowercase");
    expect(data.data.read["X-Lowercase-Header"]).toBe("value-from-lowercase");
});

test.sequential("context.http.response.headers sets custom response headers", async () => {
    const res = await fetch(`${BASE_URL}/hello-world/headers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            setHeaders: {
                "X-Response-Custom": "custom-value",
                "X-Response-Number": "12345",
            },
        }),
    });
    expect(res.ok).toBe(true);
    expect(res.headers.get("X-Response-Custom")).toBe("custom-value");
    expect(res.headers.get("X-Response-Number")).toBe("12345");
});

test.sequential("context.http.response.headers override (set then set again)", async () => {
    const res = await fetch(`${BASE_URL}/hello-world/headers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            setHeaders: {
                "X-Response-Override": "first-value",
                // 当 setHeaders 对象中有重复 key 时，JSON.stringify 只会保留最后一个
                // 但我们可以通过 deleteHeaders 再设值来模拟覆盖
            },
        }),
    });
    // 默认行为：第一次设置的值
    expect(res.headers.get("X-Response-Override")).toBe("first-value");

    // 再发一个请求，先设置再覆盖 — 由于对象 key 唯一，我们用两次请求模拟
    const res2 = await fetch(`${BASE_URL}/hello-world/headers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            setHeaders: {
                "X-Response-Override": "second-value",
            },
        }),
    });
    expect(res2.headers.get("X-Response-Override")).toBe("second-value");
});

test.sequential("context.http.response.headers delete a previously set header", async () => {
    const res = await fetch(`${BASE_URL}/hello-world/headers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            setHeaders: {
                "X-Response-Keep": "should-remain",
                "X-Response-Delete": "should-be-deleted",
            },
            deleteHeaders: ["X-Response-Delete"],
        }),
    });
    expect(res.ok).toBe(true);
    // 被删除的不应出现
    expect(res.headers.get("X-Response-Delete")).toBeNull();
    // 未被删除的保留
    expect(res.headers.get("X-Response-Keep")).toBe("should-remain");
});

test.sequential("combined: read request headers, set response headers, and verify both", async () => {
    const res = await fetch(`${BASE_URL}/hello-world/headers`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Request-Id": "req-001",
            "X-Trace-Id": "trace-aaaa",
        },
        body: JSON.stringify({
            readHeaders: ["X-Request-Id", "X-Trace-Id"],
            setHeaders: {
                "X-Response-Id": "res-001",
            },
        }),
    });
    expect(res.ok).toBe(true);
    const data = await res.json() as any;
    // 请求头正确读取
    expect(data.data.read["X-Request-Id"]).toBe("req-001");
    expect(data.data.read["X-Trace-Id"]).toBe("trace-aaaa");
    // 响应头正确设置
    expect(res.headers.get("X-Response-Id")).toBe("res-001");
});

test.sequential("delete context.http.response.headers removes headers from final response", async () => {
    // 先用不带 deleteHeaders 的请求确认某 header 正常存在
    const resWith = await fetch(`${BASE_URL}/hello-world/headers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            setHeaders: {
                "X-Delete-Test": "present",
            },
        }),
    });
    expect(resWith.ok).toBe(true);
    expect(resWith.headers.get("X-Delete-Test")).toBe("present");

    // 然后删除它
    const resWithout = await fetch(`${BASE_URL}/hello-world/headers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            setHeaders: {
                "X-Delete-Test": "present",
            },
            deleteHeaders: ["X-Delete-Test"],
        }),
    });
    expect(resWithout.ok).toBe(true);
    expect(resWithout.headers.get("X-Delete-Test")).toBeNull();
});

// -- stargate headers --

test.sequential("stargate.execute with headers option passes custom request headers", async () => {
    const [error, result] = await stargate.execute("/hello-world/headers", {
        params: {
            readHeaders: ["X-Stargate-Token", "X-Stargate-User"],
        },
        headers: {
            "X-Stargate-Token": "stargate-token-xyz",
            "X-Stargate-User": "stargate-user-99",
        },
    });

    expect(error).toBeNull();
    expect(result!.read["X-Stargate-Token"]).toBe("stargate-token-xyz");
    expect(result!.read["X-Stargate-User"]).toBe("stargate-user-99");
});

test.sequential("stargate automatically sets Content-Type and Accept", async () => {
    const [error, result] = await stargate.execute("/hello-world/headers", {
        params: {
            readHeaders: ["Content-Type", "Accept"],
        },
    });

    expect(error).toBeNull();
    expect(result!.read["Content-Type"]).toBe("application/json");
    expect(result!.read["Accept"]).toBe("application/json");
});

test.sequential("stargate milkio:fetchBefore can override headers", async () => {
    const off = stargate.on("milkio:fetchBefore", ({ options }) => {
        options.headers["X-Overridden"] = "overridden-by-event";
    });

    const [error, result] = await stargate.execute("/hello-world/headers", {
        params: {
            readHeaders: ["X-Overridden"],
        },
    });

    off();

    expect(error).toBeNull();
    expect(result!.read["X-Overridden"]).toBe("overridden-by-event");
});

test.sequential("stargate headers option + milkio:fetchBefore merge", async () => {
    const off = stargate.on("milkio:fetchBefore", ({ options }) => {
        options.headers["X-Event-Header"] = "from-event";
    });

    const [error, result] = await stargate.execute("/hello-world/headers", {
        params: {
            readHeaders: ["X-Direct-Header", "X-Event-Header"],
        },
        headers: {
            "X-Direct-Header": "from-execute-option",
        },
    });

    off();

    expect(error).toBeNull();
    expect(result!.read["X-Direct-Header"]).toBe("from-execute-option");
    expect(result!.read["X-Event-Header"]).toBe("from-event");
});
