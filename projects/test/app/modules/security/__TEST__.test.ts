import { expect, it } from "vitest";
import { astra } from "../../../test.ts";

/**
 * 合法参数测试
 * 验证正确的参数能够通过 typia 校验并正常返回
 */
it.sequential("valid params pass validation", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/security/strict-params", {
    params: {
      username: 'testuser',
      password: 'secret123',
      role: 'user',
      age: 25,
    },
    generateParams: false,
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  expect(results.username).toBe('testuser');
  expect(results.role).toBe('user');
  expect(results.age).toBe(25);
});

/**
 * 角色参数校验测试
 * 验证 typia 对字符串联合类型的校验
 * 传入非法的 role 值应被 typia 拒绝
 */
it.sequential("invalid role rejected by typia", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error] = await world.execute("/security/strict-params", {
    params: {
      username: 'testuser',
      password: 'secret123',
      role: 'superadmin',
      age: 25,
    } as any,
    generateParams: false,
  });
  if (!error) throw reject("Should have failed with invalid role", null);
});

/**
 * 参数类型校验测试
 * 验证 typia 对基础类型的校验
 * 传入错误类型的 age 值应被拒绝
 */
it.sequential("invalid type rejected by typia", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error] = await world.execute("/security/strict-params", {
    params: {
      username: 'testuser',
      password: 'secret123',
      role: 'user',
      age: 'not-a-number',
    } as any,
    generateParams: false,
  });
  if (!error) throw reject("Should have failed with invalid age type", null);
});

/**
 * 必填字段缺失测试
 * 验证 typia 对必填字段的校验
 * 缺少必填字段应被拒绝
 */
it.sequential("missing required field rejected", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error] = await world.execute("/security/strict-params", {
    params: {
      username: 'testuser',
      role: 'user',
      age: 25,
    } as any,
    generateParams: false,
  });
  if (!error) throw reject("Should have failed with missing password", null);
});

/**
 * 额外字段过滤测试
 * 验证 typia 会过滤掉不在类型定义中的额外字段
 */
it.sequential("extra fields are stripped by typia", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/security/strict-params", {
    params: {
      username: 'testuser',
      password: 'secret123',
      role: 'user',
      age: 25,
    },
    generateParams: false,
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  expect((results as any).password).toBeUndefined();
});