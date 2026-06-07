import { expect, it } from "vitest";
import { astra } from "../../../test.ts";

/**
 * $exports 内部动作调用测试
 * 验证通过 context.call 调用 $exports 目录中的内部动作
 * 内部动作不会注册为 HTTP 端点，但可通过 context.call 调用
 */
it.sequential("call internal action via context.call", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/internal/call-helper", {
    params: {
      a: 3,
      b: 7,
    },
    generateParams: false,
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  expect(results.sum).toBe(10);
  expect(results.product).toBe(21);
});

/**
 * $exports 内部动作不可直接访问测试
 * 验证内部动作不会注册为 HTTP 端点
 * 直接访问应返回 404
 */
it.sequential("internal action not accessible via http", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error] = await world.execute("/internal/helper", {
    params: {
      a: 3,
      b: 7,
    },
    generateParams: false,
  });
  if (!error) throw reject("Should have failed - internal action should not be accessible", null);
});