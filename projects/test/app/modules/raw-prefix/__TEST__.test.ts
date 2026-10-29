import { expect, test } from "vite-plus/test";

const BASE_URL = "http://localhost:9000";

// ============ [...].raw.ts（前缀 raw 路由） ============

test("raw prefix - matches nested path", async () => {
    const res = await fetch(`${BASE_URL}/raw-prefix/a/b/c`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.prefix).toBe(true);
    expect(data.path).toBe("/raw-prefix/a/b/c");
});

test("raw prefix - matches trailing slash", async () => {
    const res = await fetch(`${BASE_URL}/raw-prefix/`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.path).toBe("/raw-prefix/");
});

test("raw prefix - exact prefix without trailing slash is not captured", async () => {
    const res = await fetch(`${BASE_URL}/raw-prefix`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("NOT_FOUND");
});

test("raw prefix - sibling path is not captured", async () => {
    const res = await fetch(`${BASE_URL}/raw-prefix-other/a`);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("NOT_FOUND");
});

test("raw exact route still wins over prefix", async () => {
    const res = await fetch(`${BASE_URL}/raw/echo`, { method: "POST" });
    const data = await res.json() as any;
    expect(data.echo).toBe(true);
});
