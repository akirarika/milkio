import { expect, it } from "vitest";
import { astra } from "../../../test.ts";

const BASE_URL = "http://localhost:9000";

it.sequential("OPTIONS preflight returns CORS headers with defaults", async () => {
    const res = await fetch(`${BASE_URL}/hello-world`, { method: "OPTIONS" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
    // Extended headers should NOT be present when not configured
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(res.headers.get("Access-Control-Max-Age")).toBe("0");
    expect(res.headers.get("Access-Control-Expose-Headers")).toBeNull();
});

it.sequential("OPTIONS preflight returns CORS headers even for unknown route", async () => {
    const res = await fetch(`${BASE_URL}/non-existent-path-xyz`, { method: "OPTIONS" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
});

it.sequential("normal POST response includes CORS headers", async () => {
    const res = await fetch(`${BASE_URL}/hello-world/hello`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: "hello", b: 1 }),
    });
    expect(res.ok).toBe(true);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Type")).toBe("application/json");
});

it.sequential("generate_204 includes CORS headers", async () => {
    const res = await fetch(`${BASE_URL}/generate_204`);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
    expect(res.headers.get("Server")).toBe("milkio");
});

it.sequential("non-existent route still returns CORS headers", async () => {
    const res = await fetch(`${BASE_URL}/non-existent-route`, {
        method: "POST",
        body: "{}",
    });
    // Even on error/404, CORS headers are present
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
});

it.sequential("mirror world: context.http.cors exists (IPC proxy returns undefined)", async () => {
    const [_context, reject, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, results] = await world.execute("/cors/ping", {
        params: {},
    });
    if (error) throw reject("Milkio did not execute successfully", error);

    // In IPC (handleMessage) flow, context.http is a Proxy returning undefined,
    // so cors fields won't be detected.
    // This test verifies the action runs successfully regardless.
    expect(results.cors.hasAllowOrigin).toBe(false);
    expect(results.cors.hasAllowMethods).toBe(false);
    expect(results.cors.hasAllowHeaders).toBe(false);
});
