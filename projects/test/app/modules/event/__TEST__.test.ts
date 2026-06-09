import { expect, it } from "vitest";
import { astra } from "../../../test.ts";

/**
 * 普通 emit 测试
 * 验证事件广播机制：多个 handler 都能收到事件并处理
 */
it.sequential("emit broadcast", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/event/trigger", {
    params: { mode: 'emit' },
    generateParams: false,
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  expect(results.received).toContain('handler-a');
  expect(results.received).toContain('handler-b');
  expect(results.received.length).toBe(2);
  expect(results.approved).toBeNull();
});

/**
 * emitAllApproved 测试
 * 验证全员审批机制：所有 handler 通过则返回 true
 */
it.sequential("emitAllApproved success", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/event/trigger", {
    params: { mode: 'emitAllApproved' },
    generateParams: false,
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  expect(results.approved).toBe(true);
  expect(results.received).toContain('handler-a');
  expect(results.received).toContain('handler-b');
});

/**
 * emitAnyApproved 测试
 * 验证任意审批机制：至少一个 handler 通过则返回 true
 */
it.sequential("emitAnyApproved success", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/event/trigger", {
    params: { mode: 'emitAnyApproved' },
    generateParams: false,
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  expect(results.approved).toBe(true);
  expect(results.received).toContain('handler-a');
  expect(results.received).toContain('handler-b');
});

/**
 * $event 端点测试：通过直接 fetch 触发事件
 * 验证测试环境下的 $event 端点能正确触发事件
 */
it.sequential("direct fetch to $event endpoint", async () => {
  const eventName = "event:notify";
  const base64Name = btoa(eventName);
  const url = `http://localhost:9000/$event/${encodeURIComponent(base64Name)}`;
  const eventData = { message: 'hello', received: [] as string[] };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(eventData),
  });
  const text = await response.text();

  expect(response.status).toBe(200);
  const data = JSON.parse(text);
  expect(data.success).toBe(true);
  expect(data.data.received).toContain('handler-a');
  expect(data.data.received).toContain('handler-b');
});

/**
 * 通过 world.emit 触发事件
 * 验证返回的 data 包含 handler 的修改
 */
it.sequential("world.emit triggers event and returns modified data", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const eventData = { message: 'hello', received: [] as string[] };
  const [error, result, meta] = await world.emit("event:notify", { params: eventData });

  if (error) throw reject("Milkio did not execute successfully", error);

  expect(meta.executeId).toBeDefined();
  expect(result).toBeDefined();
  expect(result!.received).toContain('handler-a');
  expect(result!.received).toContain('handler-b');
  expect(result!.received.length).toBe(2);
});

/**
 * handler 抛异常测试：验证 world.emit 返回 INTERNAL_SERVER_ERROR
 */
it.sequential("handler throws error returns INTERNAL_SERVER_ERROR", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, result, meta] = await world.emit("event:fail", { params: { message: 'boom' } });

  expect(error).toBeDefined();
  expect(error).toHaveProperty("INTERNAL_SERVER_ERROR");
  expect(result).toBeNull();
  expect(meta.executeId).toBeDefined();
});

/**
 * context 自动注入测试：验证 world.emit 自动注入 context 到事件数据
 */
it.sequential("world.emit auto-injects context into event data", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const eventData = { received: [] as string[] };
  const [error, result] = await world.emit("event:context-check", { params: eventData });

  if (error) throw reject("Milkio did not execute successfully", error);

  // handler 检测到 context.reject 和 context.emit 存在时 push 'context-ok'
  expect(result).toBeDefined();
  expect(result!.received).toContain('context-ok');
});

/**
 * 非法 base64 路径测试
 */
it.sequential("invalid base64 returns error", async () => {
  const url = `http://localhost:9000/$event/!!!not-valid-base64!!!`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const text = await response.text();
  const data = JSON.parse(text);

  expect(response.status).toBe(200);
  expect(data.success).toBe(false);
  expect(data.code).toBe("PARAMS_TYPE_NOT_SUPPORTED");
});