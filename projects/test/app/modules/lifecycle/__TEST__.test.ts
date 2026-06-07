import { expect, it } from "vitest";
import { astra } from "../../../test.ts";

/**
 * milkio:executeBefore 生命周期钩子测试
 * 验证在请求执行前，bootstrap 能够通过钩子注入 context 属性
 */
it.sequential("executeBefore hook injects context data", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/lifecycle/hook-test", {
    params: {},
    generateParams: false,
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  expect(results.beforeHook).toBe('before-executed');
  expect(results.executeId).toBeTruthy();
  expect(results.path).toBe('/lifecycle/hook-test');
});

/**
 * milkio:executeAfter 生命周期钩子测试
 * 验证在请求执行后，bootstrap 能够通过钩子修改返回值
 */
it.sequential("executeAfter hook modifies response", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/lifecycle/hook-test", {
    params: {},
    generateParams: false,
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  expect((results as any).afterHook).toBe('after-executed');
});

/**
 * 生命周期钩子执行顺序测试
 * 验证 executeBefore 和 executeAfter 按正确顺序执行
 */
it.sequential("lifecycle hooks execute in correct order", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/lifecycle/hook-test", {
    params: {},
    generateParams: false,
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  expect(results.beforeHook).toBe('before-executed');
  expect((results as any).afterHook).toBe('after-executed');
  expect(results.executeId).toBeTruthy();
});