import { createAstra } from '@milkio/astra';
import { createStargate } from '@milkio/stargate';
import type { generated } from '../../.milkio/index.ts';
import { drizzleCleanHook, dropAllTestDatabases } from './drizzle-test.ts';
import { redisCleanHook } from './redis-test.ts';

export const stargate = await createStargate<typeof generated>({
  baseUrl: 'http://localhost:9000',
});

export const astra = await createAstra({
  stargate,
  bootstrap: async (hooks) => {
    // 每次运行测试前，先删掉上一次遗留的全部随机测试库。
    // 如果你的项目不使用数据库，可以删除下面这两行。
    await dropAllTestDatabases('mysql://root:a58423c29020@127.0.0.1:3306/');

    // 订阅 cleanDatabase 钩子：world.cleanDatabase() 每次都会新建一个随机库并切换，
    // 然后并行执行这里注册的所有 hook（建库+迁移+seed、清 redis 等）。
    hooks.onCleanDatabase(drizzleCleanHook({
      baseUrl: () => 'mysql://root:a58423c29020@127.0.0.1:3306/',
      migrationsFolder: './drizzle',
    }));
    hooks.onCleanDatabase(redisCleanHook({ url: () => 'redis://127.0.0.1:6379/1' }));

    return {};
  },
});
