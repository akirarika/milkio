// vitest globalSetup：每次测试运行只执行一次（在 vitest.config.ts 注册）。
// 负责清掉上一次运行遗留的随机测试库与缓存，保证每次运行从干净状态开始。
// 不能放在每个测试文件的 astra bootstrap 里做——并行运行时，后启动的文件会把
// 先启动文件正在使用的随机库删掉。
import { dropAllTestDatabases } from './drizzle-test.ts';
import { flushTestRedis } from './redis-test.ts';

export default async function setup() {
  await dropAllTestDatabases('mysql://root:a58423c29020@127.0.0.1:3306/');
  await flushTestRedis('redis://127.0.0.1:6379/1');
}
