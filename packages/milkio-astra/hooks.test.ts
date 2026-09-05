import { describe, expect, it } from 'vitest';
import { TEST_DATABASE_PREFIX } from '@milkio/drizzle';
import { createCleanDatabaseScheduler, type CleanDatabaseHook } from './index.ts';

const importMetaUrl = 'file:///workspace/projects/server/app/modules/user/__TEST__.test.ts';

function createWorld() {
  return { __databaseId: null as string | null };
}

describe('createCleanDatabaseScheduler', () => {
  it('每次调用都会切换到一个新的随机数据库', async () => {
    const hooks: CleanDatabaseHook[] = [];
    const cleanDatabase = createCleanDatabaseScheduler(hooks, importMetaUrl);
    const world = createWorld();

    const first = await cleanDatabase.call(world);
    const second = await cleanDatabase.call(world);

    expect(first).not.toBe(second);
    expect(first.startsWith(`${TEST_DATABASE_PREFIX}_`)).toBe(true);
    expect(world.__databaseId).toBe(second);
  });

  it('会执行所有已注册的 hook，并传入一致的 databaseId', async () => {
    const calls: Array<{ databaseId: string }> = [];
    const hooks: CleanDatabaseHook[] = [
      async ({ databaseId }) => { calls.push({ databaseId }); },
      async ({ databaseId }) => { calls.push({ databaseId }); },
    ];
    const cleanDatabase = createCleanDatabaseScheduler(hooks, importMetaUrl);
    const world = createWorld();

    const databaseId = await cleanDatabase.call(world);

    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.databaseId === databaseId)).toBe(true);
  });

  it('库名中包含测试文件的可读片段', async () => {
    const cleanDatabase = createCleanDatabaseScheduler([], importMetaUrl);
    const world = createWorld();
    const databaseId = await cleanDatabase.call(world);
    expect(databaseId).toContain('user');
  });

  it('hook 抛错时会向上传播', async () => {
    const hooks: CleanDatabaseHook[] = [
      async () => { throw new Error('boom'); },
    ];
    const cleanDatabase = createCleanDatabaseScheduler(hooks, importMetaUrl);
    const world = createWorld();
    await expect(cleanDatabase.call(world)).rejects.toThrow('boom');
  });
});
