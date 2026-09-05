import { createClient } from 'redis';
import type { CleanDatabaseHook } from '@milkio/astra';
import { testDbState } from './test-state.ts';

/**
 * 当前随机测试库的 redis key 前缀。服务端在测试模式下应把所有业务 key
 * 加上 `${databaseId}:` 前缀（参考 kecream-server 的 bootstrap/redis 与 my-redis 样板），
 * 测试文件里直连 redis 操作业务 key 时也要经过这个函数。
 */
export function testRedisKey(key: string): string {
  if (!testDbState.databaseId) throw new Error('No active test database. Call world.cleanDatabase() first.');
  return `${testDbState.databaseId}:${key}`;
}

/** 清空整个 redis db：仅在每次测试运行的 globalSetup 里调用一次。 */
export async function flushTestRedis(url: string) {
  const client = createClient({ url });
  client.on('error', (err) => console.error('Redis Client Error', err));
  await client.connect();
  await client.flushDb();
  await client.close();
}

/**
 * astra 的 cleanDatabase 钩子（Redis）：清理当前测试库命名空间下的缓存。
 * 不同测试文件共用同一个 redis 但 key 前缀不同，互不干扰，
 * 因此这里只按前缀清理，绝不能 flushDb（会误删并行中其他测试文件的数据）。
 * 这是样板实现，你可以按需修改。
 */
export function redisCleanHook(options: { url: () => string | Promise<string> }): CleanDatabaseHook {
  return async ({ databaseId }) => {
    testDbState.databaseId = databaseId;
    const url = await options.url();
    const client = createClient({ url });
    client.on('error', (err) => console.error('Redis Client Error', err));
    await client.connect();
    let cursor = '0';
    do {
      const reply = await client.scan(cursor, { MATCH: `${databaseId}:*`, COUNT: 1000 });
      cursor = String(reply.cursor);
      if (reply.keys.length > 0) await client.del(reply.keys);
    } while (cursor !== '0');
    await client.close();
  };
}
