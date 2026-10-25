import { expect, test } from "vite-plus/test";
import { createWorld, DEFAULT_BODY_LIMIT, type MilkioInit } from "milkio";
import { generated } from "../../../.milkio/index.ts";
import { configSchema } from "../../../.milkio/config-schema.ts";

const BASE_URL = "http://localhost:9000";

test("oversized request body is rejected with REQUEST_TOO_LARGE", async () => {
  const res = await fetch(`${BASE_URL}/action/large-echo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ content: "x".repeat(10 * 1024 * 1024 + 1) }),
  });
  expect(res.status).toBe(413);
  const data = await res.json() as any;
  expect(data.error.code).toBe("REQUEST_TOO_LARGE");
});

// 以下是进程内测试：dev server 的测试工程把上限放宽到了 10MB（见 projects/test/index.ts），
// 无法验证产品默认值，因此直接创建 world 并调用 listener.fetch。

async function createTestWorld(http?: MilkioInit["http"]) {
  return await createWorld(generated, configSchema, {
    port: 0,
    develop: false,
    bootstraps: [],
    http,
  });
}

// 无事件监听器时走 listener 的 fast path（生产适配器启用的分支）
async function createAdapterTestWorld() {
  return await createWorld(
    { ...generated, handlerSchema: { loadHandlers: () => [] } },
    configSchema,
    { port: 0, develop: false, bootstraps: [] },
  );
}

async function executeHttp(world: Awaited<ReturnType<typeof createTestWorld>>, body: string) {
  const response = await world.listener.fetch({
    request: new Request("http://localhost/action/large-echo", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
    }),
    env: {},
    envMode: "test",
  });
  return (await response.json()) as any;
}

async function executeAdapterHttp(world: Awaited<ReturnType<typeof createAdapterTestWorld>>, body: string) {
  const request = new Request("http://localhost/action/large-echo", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body,
  });
  // 与 node/vite 适配器一致：body 已预读并挂在 request 上
  (request as any).__bodyText = body;
  const response: any = await world.listener.fetch({ request, env: {}, envMode: "test", rawResponse: true });
  if (response.__rawResponse) return JSON.parse(response.body);
  return (await response.json()) as any;
}

test("DEFAULT_BODY_LIMIT is 10KB", () => {
  expect(DEFAULT_BODY_LIMIT).toBe(10 * 1024);
});

test("default HTTP body limit rejects bodies over 10KB", async () => {
  const world = await createTestWorld();

  // 小于默认上限的请求正常执行
  const accepted = await executeHttp(world, JSON.stringify({ content: "a".repeat(8 * 1024) }));
  expect(accepted.success).toBe(true);
  expect(accepted.data.length).toBe(8 * 1024);

  // 超过默认上限的请求被拒绝，并回传生效的上限值
  const rejected = await executeHttp(world, JSON.stringify({ content: "a".repeat(10 * 1024) }));
  expect(rejected.success).toBe(false);
  expect(rejected.error.kind).toBe("fail");
  expect(rejected.error.code).toBe("REQUEST_TOO_LARGE");
  expect(rejected.error.data.maxBodySize).toBe(DEFAULT_BODY_LIMIT);
});

test("limit boundary is inclusive in bytes", async () => {
  const world = await createTestWorld();
  const overhead = JSON.stringify({ content: "" }).length;

  // 恰好等于上限：放行
  const atLimit = JSON.stringify({ content: "a".repeat(DEFAULT_BODY_LIMIT - overhead) });
  expect(new TextEncoder().encode(atLimit).byteLength).toBe(DEFAULT_BODY_LIMIT);
  expect((await executeHttp(world, atLimit)).success).toBe(true);

  // 多 1 字节：拒绝
  const overLimit = JSON.stringify({ content: "a".repeat(DEFAULT_BODY_LIMIT - overhead + 1) });
  expect(new TextEncoder().encode(overLimit).byteLength).toBe(DEFAULT_BODY_LIMIT + 1);
  expect((await executeHttp(world, overLimit)).error.code).toBe("REQUEST_TOO_LARGE");
});

test("limit counts bytes, not UTF-16 code units", async () => {
  const world = await createTestWorld();

  // 5000 个汉字：字符数 5014 < 10KB，但 UTF-8 字节数 15014 > 10KB
  const body = JSON.stringify({ content: "汉".repeat(5000) });
  expect(body.length).toBeLessThan(DEFAULT_BODY_LIMIT);
  expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(DEFAULT_BODY_LIMIT);

  const rejected = await executeHttp(world, body);
  expect(rejected.error.code).toBe("REQUEST_TOO_LARGE");
});

test("HTTP body limit is configurable", async () => {
  const world = await createTestWorld({ bodyLimit: 2 * 1024 });

  const accepted = await executeHttp(world, JSON.stringify({ content: "a".repeat(1024) }));
  expect(accepted.success).toBe(true);

  const rejected = await executeHttp(world, JSON.stringify({ content: "a".repeat(2 * 1024) }));
  expect(rejected.success).toBe(false);
  expect(rejected.error.code).toBe("REQUEST_TOO_LARGE");
  expect(rejected.error.data.maxBodySize).toBe(2 * 1024);
});

test("maxBodySize is accepted as an alias of bodyLimit", async () => {
  const world = await createTestWorld({ maxBodySize: 1024 });
  const rejected = await executeHttp(world, JSON.stringify({ content: "a".repeat(1024) }));
  expect(rejected.error.code).toBe("REQUEST_TOO_LARGE");
  expect(rejected.error.data.maxBodySize).toBe(1024);
});

test("fast path (adapter style, pre-read body) also enforces the limit", async () => {
  const world = await createAdapterTestWorld();

  const accepted = await executeAdapterHttp(world, JSON.stringify({ content: "a".repeat(1024) }));
  expect(accepted.success).toBe(true);
  expect(accepted.data.length).toBe(1024);

  const rejected = await executeAdapterHttp(world, JSON.stringify({ content: "汉".repeat(5000) }));
  expect(rejected.success).toBe(false);
  expect(rejected.error.code).toBe("REQUEST_TOO_LARGE");
  expect(rejected.error.data.maxBodySize).toBe(DEFAULT_BODY_LIMIT);
});

test("non-HTTP execution is not limited by the HTTP body limit", async () => {
  const world = await createTestWorld({ bodyLimit: 1024 });
  const messages: Array<any> = [];

  await world.listener.handleMessage(
    { postMessage: (message: any) => messages.push(message) },
    {
      executeId: "body-limit-message-test",
      path: "/action/large-echo",
      params: { content: "a".repeat(64 * 1024) },
    },
  );

  expect(messages).toHaveLength(1);
  expect(messages[0].success).toBe(true);
  expect(messages[0].data.length).toBe(64 * 1024);
});
