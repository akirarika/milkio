// vitest globalSetup：每次测试运行只执行一次（在 vitest.config.ts 注册）。
// setup 阶段：清掉上一次运行遗留的随机测试库与缓存，并准备好「黄金库」——
// 完整迁移只在这里跑一次，之后每个测试库直接从黄金库克隆 DDL。
// teardown 阶段（测试全部结束后）：清理本次创建的随机测试库与黄金库，保持磁盘健康。
// 不能放在每个测试文件的 astra bootstrap 里做——并行运行时，后启动的文件会把
// 先启动文件正在使用的随机库删掉。
import { fileURLToPath } from 'node:url';
import { dropAllTestDatabases, dropGoldenDatabase, ensureGoldenDatabase } from './drizzle-test.ts';
import { flushTestRedis } from './redis-test.ts';

export default async function setup() {
  const baseUrl = 'mysql://root:a58423c29020@127.0.0.1:3306/kecream_server';
  await dropAllTestDatabases(baseUrl);
  await flushTestRedis('redis://127.0.0.1:6379/1');
  await ensureGoldenDatabase({
    baseUrl,
    migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
    force: true,
  });

  return async () => {
    await dropAllTestDatabases(baseUrl);
    await dropGoldenDatabase(baseUrl);
  };
}
