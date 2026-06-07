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