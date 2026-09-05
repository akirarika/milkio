import { createClient } from 'redis';
import type { CleanDatabaseHook } from '@milkio/astra';

/**
 * astra 的 cleanDatabase 钩子（Redis）：清空缓存。
 * 这是样板实现，你可以按需修改（例如只删指定前缀的 key，而不是 flushDb）。
 */
export function redisCleanHook(options: { url: () => string | Promise<string> }): CleanDatabaseHook {
  return async () => {
    const url = await options.url();
    const client = createClient({ url });
    client.on('error', (err) => console.error('Redis Client Error', err));
    await client.connect();
    await client.flushDb();
    await client.close();
  };
}
