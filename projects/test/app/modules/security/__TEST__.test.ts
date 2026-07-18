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
 * 额外字段过滤测试（开启 typeSafety，默认）
 * 验证 typia.validatePrune 会过滤掉不在 Params 类型定义中的额外字段
 * handler 收到的 params 不应包含 extraField
 */
it.sequential("extra fields are stripped when typeSafety is on", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/security/strict-params", {
    params: {
      username: 'testuser',
      password: 'secret123',
      role: 'user',
      age: 25,
      extraField: 'should-be-stripped',
      anotherExtra: 42,
    } as any,
    generateParams: false,
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  expect(results.receivedFields).not.toContain('extraField');
  expect(results.receivedFields).not.toContain('anotherExtra');
  expect(results.receivedFields).toContain('username');
  expect(results.receivedFields).toContain('password');
  expect(results.receivedFields).toContain('role');
  expect(results.receivedFields).toContain('age');
});

// ============================================================================
// 关闭 typeSafety 的测试（strict-params-off）
// ============================================================================

/**
 * 关闭 typeSafety 后额外字段保留测试
 * 验证关闭 typeSafety 后，typia 不再过滤额外字段
 * handler 收到的 params 应包含 extraField
 */
it.sequential("extra fields are preserved when typeSafety is off", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/security/strict-params-off", {
    params: {
      username: 'testuser',
      password: 'secret123',
      role: 'user',
      age: 25,
      extraField: 'should-be-preserved',
      anotherExtra: 42,
    } as any,
    generateParams: false,
  });
  if (error) throw reject("Milkio did not execute successfully", error);

  expect(results.receivedFields).toContain('extraField');
  expect(results.receivedFields).toContain('anotherExtra');
  expect(results.receivedFields).toContain('username');
  expect(results.receivedFields).toContain('password');
  expect(results.receivedFields).toContain('role');
  expect(results.receivedFields).toContain('age');
});

/**
 * 关闭 typeSafety 后类型校验失效测试
 * 验证关闭 typeSafety 后，typia 不再校验参数类型
 * 传入错误类型的 age 值不应被拒绝
 */
it.sequential("invalid type not rejected when typeSafety is off", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/security/strict-params-off", {
    params: {
      username: 'testuser',
      password: 'secret123',
      role: 'user',
      age: 'not-a-number',
    } as any,
    generateParams: false,
  });
  if (error) throw reject("Should not have failed when typeSafety is off", error);

  expect(results.username).toBe('testuser');
  expect(results.age).toBe('not-a-number');
});

/**
 * 关闭 typeSafety 后非法联合类型不被拒绝测试
 * 验证关闭 typeSafety 后，typia 不再校验联合类型
 * 传入非法的 role 值不应被拒绝
 */
it.sequential("invalid role not rejected when typeSafety is off", async () => {
  const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
  const [error, results] = await world.execute("/security/strict-params-off", {
    params: {
      username: 'testuser',
      password: 'secret123',
      role: 'superadmin',
      age: 25,
    } as any,
    generateParams: false,
  });
  if (error) throw reject("Should not have failed when typeSafety is off", error);

  expect(results.role).toBe('superadmin');
});
